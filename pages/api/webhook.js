// pages/api/webhook.js
import crypto from "crypto";

// Next.js API route must read raw body to validate signature
export const config = {
  api: { bodyParser: false },
};

// small helper to read raw body
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: "webhook_secret_missing" });

  const raw = await readRawBody(req);
  const signature = req.headers["x-razorpay-signature"];

  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  if (signature !== expected) {
    return res.status(400).json({ error: "invalid_signature" });
  }

  const event = JSON.parse(raw);

  // Idempotency: ignore duplicates
  // (You can persist processed IDs in a DB later)
  // const eventId = event.id;

  // Most useful event for one-time payments:
  if (event.event === "payment.captured") {
    const pay = event.payload.payment.entity;
    const orderId = pay.order_id;
    const paymentId = pay.id;
    const amount = pay.amount; // paise

    // ✅ TODO: mark order as paid in DB and enqueue the GPU job
    // For now, just log:
    console.log("✅ Verified payment", { orderId, paymentId, amount });
  }

  // You can also listen to:
  // - order.paid
  // - payment.failed (for debugging UX)

  return res.status(200).json({ ok: true });
}
