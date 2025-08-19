// pages/api/razorpay-webhook.js
import crypto from "crypto";

// IMPORTANT: raw body required for HMAC
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(500).send("webhook_secret_missing");

  const raw = await readRawBody(req);
  const signature = req.headers["x-razorpay-signature"];
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  if (signature !== expected) return res.status(401).send("invalid_signature");

  const body = JSON.parse(raw.toString("utf8"));
  if (body?.event !== "payment.captured") return res.status(200).send("ignored");

  const pay = body.payload.payment.entity;
  const meta = pay.notes || {};

  console.log("✅ payment.captured", {
    payment_id: pay.id,
    order_id: pay.order_id,
    amount: pay.amount,
    product: meta.product,
    minutes: meta.minutes,
    userEmail: meta.userEmail,
  });

  // Step 2: we'll call the deployer from here.
  return res.status(200).send("ok");
}
