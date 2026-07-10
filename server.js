import express from "express";
import cors from "cors";
import { google } from "googleapis";
import path from "path";
import fs from "fs";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// 📁 FILE-BASED AUTH: Explicitly loading credentials
const KEYFILEPATH = path.join(process.cwd(), "service-account.json");
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const RANGE = "Sheet1!A:I";

// Helper function: Google Sheet mein row add karne ke liye
async function appendToSheet(rowData) {
  try {
    // Auth ko har baar yahan se fetch karna sabse safe hai
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: authClient });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
      valueInputOption: "USER_ENTERED",
      resource: { values: [rowData] }
    });
  } catch (error) {
    console.error("Error writing to Google Sheet:", error.message);
    throw error;
  }
}

// Helper function: Status update
async function updateOrderStatusInSheet(orderId, newStatus) {
  try {
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: authClient });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE
    });

    const rows = response.data.values;
    if (!rows) return false;

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === orderId.toString()) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) return false;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Sheet1!H${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      resource: { values: [[newStatus]] }
    });
    return true;
  } catch (error) {
    console.error("Error updating Google Sheet:", error.message);
    throw error;
  }
}

app.post("/api/orders", async (req, res) => {
  try {
    const { id, restaurant_id, customer_name, table_no, items, notes, total } = req.body;
    const placed_at = new Date().toISOString();
    const status = "pending";
    const orderId = id || Date.now().toString();

    const newRow = [orderId, restaurant_id, customer_name, table_no, typeof items === "object" ? JSON.stringify(items) : items, notes || "", total || 0, status, placed_at];

    await appendToSheet(newRow);
    res.status(201).json({ id: orderId, status, message: "Order placed!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const isUpdated = await updateOrderStatusInSheet(id, status);
    if (isUpdated) res.json({ id, status, message: "Updated!" });
    else res.status(404).json({ error: "Order not found" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (_, res) => res.send("✅ Nevolt API is live!"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
