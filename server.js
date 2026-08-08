import express from "express";
import cors from "cors";
import Stripe from "stripe";
import admin from "firebase-admin";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const serviceAccount = require("./service-account.json"); // Teri JSON file ka path

// ⚡ Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// --- ROUTES ---

// 1. FETCH ORDERS
app.get("/api/orders", async (_, res) => {
  try {
    const snapshot = await db.collection('orders').orderBy('placed_at', 'desc').get();
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. PLACE ORDER
app.post("/api/orders", async (req, res) => {
  try {
    const { restaurant_id, customer_name, table_no, items, notes, total, payment_status } = req.body;
    const newOrder = {
      restaurant_id,
      customer_name,
      table_no,
      items: typeof items === "string" ? JSON.parse(items) : items,
      notes: notes || "",
      total: total || 0,
      status: "pending",
      placed_at: new Date().toISOString(),
      payment_status: payment_status || "paid"
    };

    const docRef = await db.collection('orders').add(newOrder);
    res.status(201).json({ id: docRef.id, ...newOrder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. UPDATE ORDER STATUS (e.g., cash_received)
app.post("/api/update-order-status", async (req, res) => {
  try {
    const { orderId, status } = req.body;
    const orderRef = db.collection('orders').doc(orderId);
    
    await orderRef.update({ 
      payment_status: "cash_received",
      paymentMethod: "cash_received" 
    });

    const updatedDoc = await orderRef.get();
    res.json({ success: true, order: { id: orderId, ...updatedDoc.data() } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. PATCH ORDER (General Status Update)
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {};
    if (req.body.status) updateData.status = req.body.status;
    if (req.body.payment_status) updateData.payment_status = req.body.payment_status;

    await db.collection('orders').doc(id).update(updateData);
    res.json({ id, ...updateData, message: "Updated in Firebase!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Checkout remains the same...
app.post("/api/create-checkout-session", async (req, res) => {
  // ... (Stripe logic as it was)
});

app.get("/", (_, res) => res.send("✅ Nevolt Firebase API is live!"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
