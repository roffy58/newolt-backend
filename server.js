import express from "express";
import cors from "cors";
import Stripe from "stripe";
import admin from "firebase-admin";

// ⚡ Load directly from Environment Variable (No parsing error ever)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// --- ROUTES ---

app.get("/api/orders", async (_, res) => {
  try {
    const snapshot = await db.collection('orders').orderBy('placed_at', 'desc').get();
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

app.post("/api/update-order-status", async (req, res) => {
  try {
    const { orderId } = req.body;
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
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (_, res) => res.send("✅ Nevolt Firebase API is live!"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
