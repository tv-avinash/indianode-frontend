// pages/api/compute/order.js
// Creates a real Razorpay Order if RZP_KEY_ID / RZP_KEY_SECRET are set.
// Falls back to "no-order" mode for local dev (Checkout can still work with amount only).

export const config = { api: { bodyParser: true }, runtime: "nodejs" };

const PRICE_60 = {
  cpu2x4: 60,   // ₹60 / 60min
  cpu4x8: 120,  // ₹120 / 60min
  cpu8x16: 240, // ₹240 / 60min
  redis4: 49,   // ₹49 / 60min
  redis8: 89,   // ₹89 / 60min
  redis16: 159, // ₹159 / 60min
};

function calcAmountPaise(sku, minutes, promo) {
  const base = PRICE_60[sku];
  if (!base) return null;
  const m = Math.max(1, Number(minutes || 1));
  let inr = Math.ceil((base / 60) * m);
  if (String(promo || "").trim().toUpperCase().startsWith("TRY")) {
    inr = Math.max(1, inr - 5);
  }
  return inr * 100; // paise
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const body = typeof req.body === "object" ? req.body : {};
    const sku = String(body.sku || body.product || "").trim(); // accept "product" too
    const minutes = Math.max(1, Number(body.minutes || 1));
    const email = (body.email || "").trim();
    const promo = (body.promo || "").trim();

    if (!sku) return res.status(400).json({ ok: false, error: "missing_sku" });

    const amountPaise = calcAmountPaise(sku, minutes, promo);
    if (!amountPaise) return res.status(400).json({ ok: false, error: "invalid_sku" });

    const KEY_ID = process.env.RZP_KEY_ID;
    const KEY_SECRET = process.env.RZP_KEY_SECRET;

    // If keys exist, create a *real* order on Razorpay
    if (KEY_ID && KEY_SECRET) {
      const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
      const r = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt: `cmp_${Date.now()}`,
          payment_capture: 1,
          notes: { sku, minutes: String(minutes), email },
        }),
      });

      const j = await r.json();
      if (!r.ok) {
        return res
          .status(502)
          .json({ ok: false, error: "rzp_order_failed", detail: j });
      }

      // Return the real order for Checkout
      return res.status(200).json({
        ok: true,
        id: j.id,
        amount: j.amount,
        currency: j.currency,
      });
    }

    // Fallback: no order_id (Checkout still works with amount only)
    return res.status(200).json({
      ok: true,
      id: null,
      amount: amountPaise,
      currency: "INR",
    });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: "server_error", detail: String(e) });
  }
}
