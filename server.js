import express from "express";
import cors from "cors";
import Stripe from "stripe";
import admin from "firebase-admin";

// ⚡ Same Clean Format as Google Sheets Authentication
const serviceAccount = {
  type: "service_account",
  project_id: "nevolt-backend",
  private_key_id: "3c01225c254828755e4045e8adc7bf02a063efc0",
  private_key: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC1zSJuQ/u2ifz/
KsGQ7xc4hm+ouHwuYlGuGA1SiAcqiUGCxJlGDAZK6oRfvpNTIjp1Kk0Kp+8/7maK
Q1ZyIVMBnUFmsQ8L47K0bid2Q6oHKBvt99falvfDovIptYRfzs68H88C+sKX449j
2Ae9gK/ZgJwXENmwLJhjxCBRsbgOHJAd/59xVL+/+qUpTUsLPjVAth2lTDwbOeYT
6ZuXMETb5HlP79UHdj1eToACoOhvIaZZzHnUr2/fkEgCPDZSgmhFFHFGwPZGdD0y
2POfPpU3Rd0h5UPe7HeDCwzu1rimZXFOZSUR5d8ocQGVOBLpdO0q0yj+SxAQvbSA
rfsPOoYjAgMBAAECggEAApgXmWTng2+Rw77oJwdG6vmQG3WkKR+Pvao1DVC2cFJe
xlzoXUWCpzC45/hEeC5aR8JIwyQpvF06NDLbfllpqqiEEPWgrQzBR8AZfTGpZ7gq
gm3oWJXa4qHBc2nD78jlqbat6KgeM9rrHSgtaKscjhtjZ++1VKDJs+ByjZxwb5w7
Humi0OOQYYuGIQAmglROtw4FY3WARw72ca3TbxOQp9Eok+baQgfdAgSbELWCVBqh
kwzJm7G8K5IU5QOTTUME8HgSmNdFvCU/MVGgLHcCEXzM/STuM/Nx2JiEkCzltL2E
fc8iIE4oFdZvN5hEOvMfCf/PyfIKX1xg0w/YoaUxwQKBgQDqfImowAKz9u4XEZS8
gNDoho/SJ7RIXX2lv80gICQq5TLvZOkZn1B2xAZrCLZafs35x5FSAih4uy4sHlM4
3N8Z7q2aPtfNa8JFad9MAcL/y/my+CxNNzcWxcqZIjJTnUlM8i8bBvdw4xRNLlcu
hCj1FWn+GRVHvppDe0WrqemfEQKBgQDGeymfBozAUQOSQD0IMPWUE/lvJJNAyXDo
yTRYpYv6sKnD+gsRg+GFo03O2RCYmpMJ5EIr1f339Tp7j58RaPUQh96v/F7ffamf
nozUozX8dJOZuneUZdFbK3eytzVZeLHD7Uyme4mqby0gUcVgkCw6SpNwz4OBwugm8
avuEkLH58wKBgDP8vIB/YZoIyyyuJy3L2YVUIBrV1rCcmbjf11iiB6LDAhH1a4DU
w4AxYcLlQZi6uGwChQOLmvF5fnklmAnpXkVfl3m1KR9QHthI6srtMRCJZqj5QMk1
zq7r10kwPbwwCQpYP31chAuxLNUXyxhzEKmVv9QoN4GajpUbhYzTtQohAoGAGURe
lQ8JZgYqNTkWS++no7UzQNHgKRQ72naawlo4yq4ovnkbZZxrXk7eveFmOncbFtxH
DDuOvD0st8Qd1OKOqA8T60VucncV2+uz/cDDWNt0tkpFewsTbXn5AlssjoqLy4LX
nvpFGTxT+1RNkzBnYPhTcr4IGMHOOf70Czep5rb8CgYEA5EwpSuf4NGae0mGtdD8S
rquzxWoWHvhicELBfmO1tbkOrRGeoFRmk7F2oS5c9zl2tQ1hlcLFBK9PZgvgcZyo
Sy6IoH7/5S0Y8KvH8YqJa/aH1QJ/SaGhOvnWmzz0Kdskk0prwLmVC3O1AgiQSfmu
ndht46g12lPjTXkjoQAdBSm0=
-----END PRIVATE KEY-----`,
  client_email: "firebase-adminsdk-fbsvc@nevolt-backend.iam.gserviceaccount.com",
  client_id: "101471796744125862220",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40nevolt-backend.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

// ⚡ Initialize Firebase safely
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

// 5. CREATE CHECKOUT SESSION
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
