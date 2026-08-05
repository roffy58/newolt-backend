import express from "express";
import cors from "cors";
import { google } from "googleapis";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// ⚡ HARDCODED AUTH (Using backticks `` to safely handle multiline and escape sequences)
function getSheetsInstance() {
  const credentials = {
    type: "service_account",
    project_id: "newolt-db",
    private_key_id: "9b4bd56ccb02d9ba4b07849f817737ee2a1d87d2",
    private_key: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDprErd5K7LqUi/
JcZBnSxXA1FUHOodjlxc85m5ZJXFgYYwXV/0cWUVHEK4+/2ynwBhWZ7bjlDC76J5
gxJ+9wvK4J3LhOpRGwKma0Yrl03G595dh3pzr/+n6y3TWsj3CCSiYMPpcUYN6Fq6
Dywe6F8dWN91MY6xmAAB9gF7NJK8EO+7MKruvDxn/e+T1LaI59zHEkriNV44yh01
VHIPJ1rTLhL7bP2lqjpm8gHacprKrW+2HNtOCKLjuePY+ivOU8XDPZmjoIBKXj3O
94blXgNQKGBKT0f8e9t5ca7zEACdz9JYM4LAfnuCxFJpJdWaK575KJzcxKtnC90u
5pXjDyt9AgMBAAECggEAAhDzcoXYo9Vh3srTN3ZP048kc3Vz/oHpQCspQ1Hn3yC3
koro080C405mKqOTyTYNt06nEHLwNOEQkzl8+uFtWcRlsMyCk+gEvHr7WlxSpD0d
or8VbptyS8ZRF+rYFxMb29G2OcS2JV5WGwoSTk2otaY5B5zCEcDx0xKdTb0XxRDu
8d+FTNLH174zwU7xfCEDBhl/bxbRGdtAI5FBywZdBIZlZmvuM4CK0tsATaVO/8WO
L1+xVyYiwLOe0FIE2pRgS39gWH78Ezy7yCyhaIW+2tPsI1aQJITVD4YDvw8DytPl
voIcqZl7Qg2uCgHAy/rzs1Iosz8NVqyOEtRGmJo6wQKBgQD8fFbnSA1uYOp1dXrY
1JpTTT9FsxlVwiyFVMoCqLllkVrYWDYDRc07Anry8PlCg0jPkHdpQ9WfsWB9vsoZ
er5NmKd/tAupAJJUR3Qu0WrwnDHLTapjhRNAkuv7I8wJRyF7l5hdEp7rZjjXP1xt
07XKByImNM4nHn1aBa60xaevYQKBgQDs7Otbr3t8u7xzfMzQo/WPK2b+vXdktvUQ
VlDY2zS7NwpC5AHpngs9ECqQSGcrLxJ6L9xZl5KybSjMZVxkOr5jPRCJwe8mQ+rT
s/LaG9VO+IjR1a4tiqLh3d/sUpLi3caamq2gLJhIFtRUpcrRQLfLjEL5rglBCTYN
CpUfrX69nQKBgQC3SixsSco2TvTlwBsmPXCq+HDuUE4cC5H2WM8tjv7H1PV2CNNt
HMcYB3zp0DWjK1s4E1AcgroZ69J4doCQbqKoAiHWewXb8iZIOHcHZc+UTE95nzAK
fxiyz/WvoxUDxzdvWWWqa1Ii4VpyJ/UZZY+a0gLgaYUesOue5nElmjdZAQKBgEV/
WaqTVw3HpAfcW9f3wFg2ywd+XD9Wy5v3Nc/mvRkNlBz69PSqP3GyBEo+csTgEfN1
hpVhOM7N5mHOecOM17wUdX1zPctjsMZYyqvf7joz/S5QF7+UIyNOChkwP5X8p/1B
0hxh+GltCOurlkq7SS6T/jFvM5e4M/qvV/7qzXqhAoGAAb/ho/Ja058l1HBjLAUI
W5Jj3EziqtwFaVqC3ptr8kzZQX8Qaw9GYjeQO9IoQicKgsHF+LfzPFSy8E9ZmJ/I
7UCo9/YuvUIpNcDtjppyy1kc+l62w9Gz82jOdEjGj31fGfkSW1Q5mRAreZZ0MovM
Et/lVlOVZFRxgCx1wq/kEoY=
-----END PRIVATE KEY-----`,
    client_email: "newoltdb@newolt-db.iam.gserviceaccount.com",
    client_id: "111076780535688924970",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/newoltdb%40newolt-db.iam.gserviceaccount.com"
  };

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

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { total, orderId, tableNo, customerName } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: `Table #${tableNo || 'N/A'} - Order (${customerName || 'Customer'})`,
            },
            unit_amount: Math.round(Number(total || 0) * 100),
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

    if (status) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Sheet1!H${rowIndex}`,
        valueInputOption: "USER_ENTERED",
        resource: { values: [[status]] }
      });
    }

    if (payment_status) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Sheet1!J${rowIndex}`,
        valueInputOption: "USER_ENTERED",
        resource: { values: [[payment_status]] }
      });
    }

    res.json({ id, status, payment_status, message: "Updated!" });
  } catch (error) {
    console.error("❌ Update Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (_, res) => res.send("✅ Nevolt API is live!"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
