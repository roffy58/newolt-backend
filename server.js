import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// Load environment variables
const {
  DATABASE_URL,
  PGHOST,
  PGPORT,
  PGUSER,
  PGPASSWORD,
  PGDATABASE,
  SUPABASE_SNI_HOST
} = process.env;

// Build pool configuration. Support either DATABASE_URL (preferred) or individual PG_* vars.
let poolConfig = {};

// Resolve non-secret connection details for debug logging
let resolvedHost;
let resolvedPort;
let resolvedServername;

if (DATABASE_URL) {
  try {
    const url = new URL(DATABASE_URL);
    resolvedHost = url.hostname;
    resolvedPort = url.port || "6543";
  } catch (e) {
    // ignore
  }
  resolvedServername = SUPABASE_SNI_HOST || resolvedHost;

  poolConfig.connectionString = DATABASE_URL;
  poolConfig.ssl = {
    rejectUnauthorized: false,
    // SNI required by Supabase pooler in many cases
    servername: resolvedServername
  };
} else if (PGHOST && PGUSER && PGPASSWORD) {
  resolvedHost = PGHOST;
  resolvedPort = PGPORT ? String(PGPORT) : "6543";
  resolvedServername = SUPABASE_SNI_HOST || PGHOST;

  poolConfig = {
    host: PGHOST,
    port: PGPORT ? Number(PGPORT) : 6543,
    user: PGUSER,
    password: PGPASSWORD,
    database: PGDATABASE || "postgres",
    ssl: {
      rejectUnauthorized: false,
      servername: resolvedServername
    }
  };
} else {
  console.error("Missing database configuration. Set DATABASE_URL or PGHOST/PGUSER/PGPASSWORD environment variables.");
  // Do not exit immediately — allow server to start for debugging, but log clearly
}

// Non-secret debug log to help confirm what the app will send in SNI
console.log("DB debug (non-secret):", {
  usingDatabaseUrl: !!DATABASE_URL,
  host: resolvedHost,
  port: resolvedPort,
  servername: resolvedServername
});

const pool = new Pool(poolConfig);

// 🧩 Ensure table exists (fallback for total / total_price)
async function ensureTables() {
  try {
    if (!pool) {
      console.error("No pool configured; skipping ensureTables.");
      return;
    }
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        restaurant_id TEXT,
        customer_name TEXT,
        table_no TEXT,
        items JSONB,
        notes TEXT,
        total NUMERIC, -- fallback legacy column
        total_price NUMERIC, -- new column for updated code
        status TEXT DEFAULT 'pending',
        placed_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Orders table ready (with total and total_price columns)");
  } catch (err) {
    console.error("❌ Could not ensure tables (DB error):", err.message);
    // Do not throw — keep server running so you can inspect logs and fix envs
  }
}

// 🟢 Create new order
app.post("/api/orders", async (req, res) => {
  try {
    const { restaurant_id, customer_name, table_no, items, notes, total } = req.body;
    const totalValue = parseFloat(total) || 0;

    // Try inserting using total_price, fallback to total if needed
    let result;
    try {
      result = await pool.query(
        `INSERT INTO orders (restaurant_id, customer_name, table_no, items, notes, total_price, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING *`,
        [restaurant_id, customer_name, table_no, JSON.stringify(items), notes || "", totalValue]
      );
    } catch (err) {
      // fallback for older DBs that have only 'total'
      result = await pool.query(
        `INSERT INTO orders (restaurant_id, customer_name, table_no, items, notes, total, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING *`,
        [restaurant_id, customer_name, table_no, JSON.stringify(items), notes || "", totalValue]
      );
    }

    console.log("✅ New order created:", {
      id: result.rows[0].id,
      customer_name,
      table_no,
      total: totalValue,
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error creating order:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🟢 Get all orders
app.get("/api/orders", async (req, res) => {
  try {
    const { restaurant_id } = req.query;

    const result = await pool.query(
      `SELECT * FROM orders WHERE restaurant_id = $1 ORDER BY placed_at DESC`,
      [restaurant_id]
    );

    console.log(`🧾 Orders fetched: ${result.rows.length} for ${restaurant_id}`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching orders:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🟡 Update order status (complete)
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Order not found" });
    }

    console.log(`✅ Order #${id} marked as ${status}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error updating order:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🩺 Health check
app.get("/", (_, res) => res.send("✅ Nevolt backend running!"));

// 🚀 Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  // Attempt to create tables, but don't exit on failure
  await ensureTables();
});
