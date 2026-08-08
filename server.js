import express from "express";
import cors from "cors";
import Stripe from "stripe";
import admin from "firebase-admin";

// ⚡ FIXED PRIVATE KEY FORMATTING
const serviceAccount = {
  type: "service_account",
  project_id: "nevolt-backend",
  private_key_id: "3c01225c254828755e4045e8adc7bf02a063efc0",
  // Yahan .replace lagane se saare escaped newlines fix ho jayenge!
  private_key: `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC1zSJuQ/u2ifz/\nKsGQ7xc4hm+ouHwuYlGuGA1SiAcqiUGCxJlGDAZK6oRfvpNTIjp1Kk0Kp+8/7maK\nQ1ZyIVMBnUFmsQ8L47K0bid2Q6oHKBvt99falvfDovIptYRfzs68H88C+sKX449j\n2Ae9gK/ZgJwXENmwLJhjxCBRsbgOHJAd/59xVL+/+qUpTUsLPjVAth2lTDwbOeYT\n6ZuXMETb5HlP79UHdj1eToACoOhvIaZZzHnUr2/fkEgCPDZSgmhFFHFGwPZGdD0y\n2POfPpU3Rd0h5UPe7HeDCwzu1rimZXFOZSUR5d8ocQGVOBLpdO0q0yj+SxAQvbSA\nrfsPOoYjAgMBAAECggEAApgXmWTng2+Rw77oJwdG6vmQG3WkKR+Pvao1DVC2cFJe\nxlzoXUWCpzC45/hEeC5aR8JIwyQpvF06NDLbfllpqqiEEPWgrQzBR8AZfTGpZ7gq\ngm3oWJXa4qHBc2nD78jlqbat6KgeM9rrHSgtaKscjhtjZ++1VKDJs+ByjZxwb5w7\nHumi0OOQYYuGIQAmglROtw4FY3WARw72ca3TbxOQp9Eok+baQgfdAgSbELWCVBqh\nkwzJm7G8K5IU5QOTTUME8HgSmNdFvCU/MVGgLHcCEXzM/STuM/Nx2JiEkCzltL2E\nfc8iIE4oFdZvN5hEOvMfCf/PyfIKX1xg0w/YoaUxwQKBgQDqfImowAKz9u4XEZS8\ngNDoho/SJ7RIXX2lv80gICQq5TLvZOkZn1B2xAZrCLZafs35x5FSAih4uy4sHlM4\n3N8Z7q2aPtfNa8JFad9MAcL/y/my+CxNNzcWxcqZIjJTnUlM8i8bBvdw4xRNLlcu\nhCj1FWn+GRVHvppDe0WrqemfEQKBgQDGeymfBozAUQOSQD0IMPWUE/lvJJNAyXDo\nyTRYpYv6sKnD+gsRg+GFo03O2RCYmpMJ5EIr1f339Tp7j58RaPUQh96v/F7ffamf\nozUozX8dJOZuneUZdFbK3eytzVZeLHD7Uyme4mqby0gUcVgkCw6SpNwz4OBwugm8\navuEkLH58wKBgDP8vIB/YZoIyyyuJy3L2YVUIBrV1rCcmbjf11iiB6LDAhH1a4DU\nw4AxYcLlQZi6uGwChQOLmvF5fnklmAnpXkVfl3m1KR9QHthI6srtMRCJZqj5QMk1\nzq7r10kwPbwwCQpYP31chAuxLNUXyxhzEKmVv9QoN4GajpUbhYzTtQohAoGAGURe\nlQ8JZgYqNTkWS++no7UzQNHgKRQ72naawlo4yq4ovnkbZZxrXk7eveFmOncbFtxH\nDDuOvD0st8Qd1OKOqA8T60VucncV2+uz/cDDWNt0tkpFewsTbXn5AlssjoqLy4LX\nnvpFGTxT+1RNkzBnYPhTcr4IGMHOOf70Czep5rb8CgYEA5EwpSuf4NGae0mGtdD8S\nrquzxWoWHvhicELBfmO1tbkOrRGeoFRmk7F2oS5c9zl2tQ1hlcLFBK9PZgvgcZyo\nSy6IoH7/5S0Y8KvH8YqJa/aH1QJ/SaGhOvnWmzz0Kdskk0prwLmVC3O1AgiQSfmu\ndht46g12lPjTXkjoQAdBSm0=\n-----END PRIVATE KEY-----`.replace(/\\n/g, '\n'),
  client_email: "firebase-adminsdk-fbsvc@nevolt-backend.iam.gserviceaccount.com",
  client_id: "101471796744125862220",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40nevolt-backend.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Baaki sara code waisa hi rahega...
