// Create a Razorpay order for COMPUTE products
import Razorpay from "razorpay";

const PRICE60 = {
  cpu2x4: 60,
  cpu4x8: 120,
  cpu8x16: 240,
  redis4: 49,
  redis8: 89,
  redis16: 159,
};

// Accept a couple of aliases so mismatched keys don't break
const ALIAS = {
  "cpu_2_4": "cpu2x4",
  "cpu_4_8": "cpu4x8",
  "cpu_8_16": "cpu8x16",
  "redis_4": "redis4",
  "redis_8": "redis8",
  "redis_16": "redis16",
};

function normProduct(p) {
  const k = (p || "").trim();
  return PRICE60[k] ? k : ALIAS[k] || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  try {
    const { product, minutes, userEmail, promo } = req.body || {};
    const key = normProduct(product);
    if (!key) return res.status(400).json({ error: "invalid_product" });

    const m = Math.max(1, Number(minutes || 1));
    const base = PRICE60[key];
    let totalInr = Math.ceil((base / 60) * m);

    const promoCode = String(promo || "").trim().toUpperCase();
    if (promoCode === "TRY" || promoCode === "TRY10") totalInr = Math.max(1, totalInr - 5);

    const amountPaise = Math.max(100, totalInr * 100); // Razorpay min ₹1

    const rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await rzp.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `cmp_${key}_${Date.now()}`,
      notes: {
        product: key,
        minutes: String(m),
        email: userEmail || "",
        promo: promoCode || "",
      },
    });

    return res.json(order); // {id, amount, currency, ...}
  } catch (e) {
    console.error("compute/order error", e);
    return res.status(500).json({ error: "order_failed" });
  }
}
