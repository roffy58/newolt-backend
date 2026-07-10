import express from "express";
import cors from "cors";
import { google } from "googleapis";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// ⚡ HARDCODED AUTH: Credentials directly embedded
function getSheetsInstance() {
  const credentials = {
    type: "service_account",
    project_id: "newolt-db",
    private_key_id: "9b4bd56ccb02d9ba4b07849f817737ee2a1d87d2",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDprErd5K7LqUi/\nJcZBnSxXA1FUHOodjlxc85m5ZJXFgYYwXV/0cWUVHEK4+/2ynwBhWZ7bjlDC76J5\ngxJ+9wvK4J3LhOpRGwKma0Yrl03G595dh3pzr/+n6y3TWsj3CCSiYMPpcUYN6Fq6\nDywe6F8dWN91MY6xmAAB9gF7NJK8EO+7MKruvDxn/e+T1LaI59zHEkriNV44yh01\nVHIPJ1rTLhL7bP2lqjpm8gHacprKrW+2HNtOCKLjuePY+ivOU8XDPZmjoIBKXj3O\n94blXgNQKGBKT0f8e9t5ca7zEACdz9JYM4LAfnuCxFJpJdWaK575KJzcxKtnC90u\n5pXjDyt9AgMBAAECggEAAhDzcoXYo9Vh3srTN3ZP048kc3Vz/oHpQCspQ1Hn3yC3\nkoro080C405mKqOTyTYNt06nEHLwNOEQkzl8+uFtWcRlsMyCk+gEvHr7WlxSpD0d\nor8VbptyS8ZRF+rYFxMb29G2OcS2JV5WGwoSTk2otaY5B5zCEcDx0xKdTb0XxRDu\n8d+FTNLH174zwU7xfCEDBhl/bxbRGdtAI5FBywZdBIZlZmvuM4CK0tsATaVO/8WO\nL1+xVyYiwLOe0FIE2pRgS39gWH78Ezy7yCyhaIW+2tPsI1aQJITVD4YDvw8DytPl\nvoIcqZl7Qg2uCgHAy/rzs1Iosz8NVqyOEtRGmJo6wQKBgQD8fFbnSA1uYOp1dXrY\n1JpTTT9FsxlVwiyFVMoCqLllkVrYWDYDRc07Anry8PlCg0jPkHdpQ9WfsWB9vsoZ\ner5NmKd/tAupAJJUR3Qu0WrwnDHLTapjhRNAkuv7I8wJRyF7l5hdEp7rZjjXP1xt\n07XKByImNM4nHn1aBa60xaevYQKBgQDs7Otbr3t8u7xzfMzQo/WPK2b+vXdktvUQ\nVlDY2zS7NwpC5AHpngs9ECqQSGcrLxJ6L9xZl5KybSjMZVxkOr5jPRCJwe8mQ+rT\ns/LaG9VO+IjR1a4tiqLh3d/sUpLi3caamq2gLJhIFtRUpcrRQLfLjEL5rglBCTYN\nCpUfrX69nQKBgQC3SixsSco2TvTlwBsmPXCq+HDuUE4cC5H2WM8tjv7H1PV2CNNt\nHMcYB3zp0DWjK1s4E1AcgroZ69J4doCQbqKoAiHWewXb8iZIOHcHZc+UTE95nzAK\nfxiyz/WvoxUDxzdvWWWqa1Ii4VpyJ/UZZY+a0gLgaYUesOue5nElmjdZAQKBgEV/\nWaqTVw3HpAfcW9f3wFg2ywd+XD9Wy5v3Nc/mvRkNlBz69PSqP3GyBEo+csTgEfN1\nhpVhOM7N5mHOecOM17wUdX1zPctjsMZYyqvf7joz/S5QF7+UIyNOChkwP5X8p/1B\n0hxh+GltCOurlkq7SS6T/jFvM5e4M/qvV/7qzXqhAoGAAb/ho/Ja058l1HBjLAUI\nW5Jj3EziqtwFaVqC3ptr8kzZQX8Qaw9GYjeQO9IoQicKgsHF+LfzPFSy8E9ZmJ/I\n7UCo9/YuvUIpNcDtjppyy1kc+l62w9Gz82jOdEjGj31fGfkSW1Q5mRAreZZ0MovM\nEt/lVlOVZFRxgCx1wq/kEoY=\n-----END PRIVATE KEY-----\n",
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

const SPREADSHEET_ID =1FtVFv0QBzmoMSFpV4EjFvZRoaLBysF_JfU7IBy9oQZk;
const RANGE = "Sheet1!A:I";

// --- ROUTES ---

app.post("/api/orders", async (req, res) => {
  try {
    const { id, restaurant_id, customer_name, table_no, items, notes, total } = req.body;
    const placed_at = new Date().toISOString();
    const status = "pending";
    const orderId = id || Date.now().toString();

    const newRow = [orderId, restaurant_id, customer_name, table_no, typeof items === "object" ? JSON.stringify(items) : items, notes || "", total || 0, status, placed_at];

    const sheets = getSheetsInstance(); 
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
      valueInputOption: "USER_ENTERED",
      resource: { values: [newRow] }
    });

    res.status(201).json({ id: orderId, status, message: "Order placed!" });
  } catch (error) {
    console.error("❌ Order Creation Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
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

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Sheet1!H${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      resource: { values: [[status]] }
    });

    res.json({ id, status, message: "Updated!" });
  } catch (error) {
    console.error("❌ Update Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (_, res) => res.send("✅ Nevolt API is live!"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
