import express from "express";
import cors from "cors";
import { google } from "googleapis";
import Stripe from "stripe";

// Stripe initialization using environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// ⚡ Dynamic Auth using Environment Variable (Untouched & Safe)
function getSheetsInstance() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

  const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );

  return google.sheets({ version: "v4", auth });
}

const SPREADSHEET_ID = "1FtVFv0QBzmoMSFpV4EjFvZRoaLBysF_JfU7IBy9oQZk";
const RANGE = "Sheet1!A:J";

// --- ROUTES ---

app.get("/api/orders", async (_, res) => {
  try {
    const sheets = getSheetsInstance();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return res.json([]);
    }

    const dataRows = rows.slice(1);
    const orders = dataRows.map(row => ({
      id: row[0],
      restaurant_id: row[1],
      customer_name: row[2],
      table_no: row[3],
      items: typeof row[4] === 'string' ? JSON.parse(row[4] || "[]") : row[4],
      notes: row[5],
      total: row[6],
      status: row[7],
      placed_at: row[8],
      payment_status: row[9] || "paid", 
      paymentMethod: row[9] === "cash_pending" ? "cash" : (row[9] === "cash_received" ? "cash_received" : "paid")
    }));

    res.json(orders);
  } catch (error) {
    console.error("❌ Fetch Orders Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const { id, restaurant_id, customer_name, table_no, items, notes, total, payment_status } = req.body;
    const placed_at = new Date().toISOString();
    const status = "pending";
    const orderId = id || Date.now().toString();
    const finalPaymentStatus = payment_status || "paid";

    const newRow = [
      orderId, 
      restaurant_id, 
      customer_name, 
      table_no, 
      typeof items === "object" ? JSON.stringify(items) : items, 
      notes || "", 
      total || 0, 
      status, 
      placed_at,
      finalPaymentStatus 
    ];

    const sheets = getSheetsInstance(); 
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
      valueInputOption: "USER_ENTERED",
      resource: { values: [newRow] }
    });

    res.status(201).json({ id: orderId, status, payment_status: finalPaymentStatus, message: "Order placed!" });
  } catch (error) {
    console.error("❌ Order Creation Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// --- STRIPE CHECKOUT SESSION ROUTE ---
app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { items, total, orderId, tableNo, customerName } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: `Table #${tableNo || 'N/A'} - Order (${customerName || 'Customer'})`,
            },
            unit_amount: Math.round(Number(total || 0) * 100), // Amount in paise
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `https://nevolt.netlify.app/`,
      cancel_url: `https://nevolt.netlify.app/`,
      metadata: { orderId: String(orderId), tableNo: String(tableNo), customerName: String(customerName) },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("❌ Stripe Session Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, payment_status } = req.body;

    const sheets = getSheetsInstance();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE
    });

    const rows = response.data.values;
    let rowIndex = -1;
    if (rows) {
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === id.toString()) {
          rowIndex = i + 1;
          break;
        }
      }
    }

    if (rowIndex === -1) return res.status(404).json({ error: "Order not found" });

    // Update status (Column H) if provided
    if (status !== undefined) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Sheet1!H${rowIndex}`,
        valueInputOption: "USER_ENTERED",
        resource: { values: [[status]] }
      });
    }

    // Update payment_status (Column J) - Handles Cash Confirmations & updates dynamically for customer view
    if (payment_status !== undefined) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Sheet1!J${rowIndex}`,
        valueInputOption: "USER_ENTERE_D" in Object ? "USER_ENTERED" : "USER_ENTERED",
        resource: { values: [[payment_status]] }
      });
    }

    res.json({ id, status, payment_status, message: "Updated successfully!" });
  } catch (error) {
    console.error("❌ Update Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (_, res) => res.send("✅ Nevolt API is live!"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
