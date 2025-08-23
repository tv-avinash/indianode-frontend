// pages/api/compute/order.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"method_not_allowed" });

  const b = (typeof req.body === "object" && req.body) ? req.body : {};
  const sku = String(b.sku || b.product || "").trim();
  const minutes = Math.max(1, Number(b.minutes || 1));
  const email = (b.email || "").trim();
  const promo = (b.promo || "").trim();

  if (!sku) return res.status(400).json({ ok:false, error:"missing_sku" });

  const PRICE_60 = { cpu2x4: 60, cpu4x8: 120, cpu8x16: 240, redis4: 49, redis8: 89, redis16: 159 };
  const base = PRICE_60[sku];
  if (!base) return res.status(400).json({ ok:false, error:"invalid_sku" });

  let amountInr = Math.ceil((base/60)*minutes);
  if (/^TRY(10)?$/i.test(promo)) amountInr = Math.max(1, amountInr-5);

  // TODO: integrate Razorpay order creation; return its id/amount/currency
  return res.status(200).json({
    ok: true,
    id: "order_" + Date.now(),
    amount: Math.max(1, amountInr) * 100,
    currency: "INR",
  });
}
