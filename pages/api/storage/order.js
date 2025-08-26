// pages/api/storage/order.js
export const config = { api: { bodyParser: true } };

const PRICE60 = { nvme200: 49, nvme500: 99, nvme1tb: 149 }; // ₹ base for 60 min

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }
  try {
    const { product, minutes, userEmail = "", promo = "" } = req.body || {};
    const prod = String(product || "").toLowerCase();
    const mins = Math.max(1, Math.min(240, Number(minutes || 60)));

    if (!PRICE60[prod]) return res.status(400).json({ error: "invalid_product" });

    // compute amount in INR (match frontend logic)
    const base = PRICE60[prod];
    let expectedInr = Math.ceil((base / 60) * mins);
    const code = String(promo || "").trim().toUpperCase();
    if (code === "TRY" || code === "TRY10") expectedInr = Math.max(1, expectedInr - 5);

    const key = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key || !secret) return res.status(500).json({ error: "razorpay_keys_missing" });

    // Create Razorpay order
    const auth = "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
    const orderBody = {
      amount: expectedInr * 100, // paise
      currency: "INR",
      receipt: `stor_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      notes: { product: prod, minutes: String(mins), email: userEmail, promo: code || undefined },
      payment_capture: 1,
    };

    const rp = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(orderBody),
    });
    const j = await rp.json().catch(() => null);
    if (!rp.ok) return res.status(400).json({ error: "razorpay_order_failed", details: j });

    // send to client (client uses amount/currency/id)
    return res.status(200).json({
      id: j.id,
      amount: j.amount,
      currency: j.currency,
      product: prod,
      minutes: mins,
    });
  } catch (e) {
    console.error("[storage/order]", e);
    return res.status(500).json({ error: "order_exception", message: e.message });
  }
}
