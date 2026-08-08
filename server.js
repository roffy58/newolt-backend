import express from "express";
import cors from "cors";
import Stripe from "stripe";
import admin from "firebase-admin";
import http from "http";
import { Server } from "socket.io";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

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
    const snapshot = await db.collection('orders').get();
    let orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (restaurant_id) {
      orders = orders.filter(order => order.restaurant_id === restaurant_id);
    }

    orders.sort((a, b) => new Date(b.placed_at || 0) - new Date(a.placed_at || 0));
    res.json(orders);
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

    const newOrder = {
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

    const docRef = await db.collection('orders').add(newOrder);
    const savedOrder = { id: docRef.id, ...newOrder };

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

app.get("/", (_, res) => res.send("✅ Nevolt Firebase API & WebSocket is live!"));

const PORT = process.env.PORT || 10000;
// Note: Use server.listen instead of app.listen when using socket.io
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
