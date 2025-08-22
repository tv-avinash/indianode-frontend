// pages/api/compute/order.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

    const { sku, minutes = 1, email = "" } = req.body || {};
    if (!sku) return res.status(400).json({ ok: false, error: "missing_sku" });

    const M = Math.max(1, Number(minutes || 1));

    // INR per-minute (edit to your pricing)
    const RATE = {
      cpu2x4: 1,   // ₹/min
      cpu4x8: 2,
      cpu8x16: 3,
      cpu16x32: 5,
      cpu32x64: 9,
      generic: 1
    };
    const perMin = RATE[sku] ?? 1;
    const amountInr = Math.max(1, Math.ceil(perMin * M));
    const amountPaise = amountInr * 100;

    const keyId = process.env.RZP_KEY_ID;
    const keySecret = process.env.RZP_KEY_SECRET;
    if (!keyId || !keySecret) {
      return res.status(500).json({ ok: false, error: "razorpay_env_missing" });
    }

    // Create order with Razorpay REST
    const r = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64"),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `cmp_${sku}_${Date.now()}`,
        notes: { sku, minutes: String(M), email }
      })
    });

    const j = await r.json();
    if (!r.ok) {
      return res.status(400).json({ ok: false, error: j?.error?.description || "rzp_order_failed" });
    }

    return res.json({
      ok: true,
      id: j.id,
      amount: j.amount,
      currency: j.currency,
      sku,
      minutes: M
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
