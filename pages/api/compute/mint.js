// Verify Razorpay payment and mint a short-lived ORDER_TOKEN for compute jobs
import Razorpay from "razorpay";
import crypto from "crypto";

const PRICE60 = {
  cpu2x4: 60,
  cpu4x8: 120,
  cpu8x16: 240,
  redis4: 49,
  redis8: 89,
  redis16: 159,
};
const ALIAS = {
  "cpu_2_4": "cpu2x4",
  "cpu_4_8": "cpu4x8",
  "cpu_8_16": "cpu8x16",
  "redis_4": "redis4",
  "redis_8": "redis8",
  "redis_16": "redis16",
};
const normProduct = (p) => (PRICE60[p || ""] ? p : ALIAS[p || ""] || null);

// simple HMAC "JWT-like" token
function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "OT1" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${header}.${body}`;
  const sig = crypto
    .createHmac("sha256", process.env.ORDER_TOKEN_SIGNING_KEY || "dev-secret")
    .update(data)
    .digest("base64url");
  return `v1.${data}.${sig}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  try {
    const { paymentId, product, minutes, email, promo } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: "missing_payment_id" });

    const key = normProduct(product);
    if (!key) return res.status(400).json({ error: "invalid_product" });

    const m = Math.max(1, Number(minutes || 1));
    const base = PRICE60[key];
    let expectedInr = Math.ceil((base / 60) * m);

    const promoCode = String(promo || "").trim().toUpperCase();
    if (promoCode === "TRY" || promoCode === "TRY10") expectedInr = Math.max(1, expectedInr - 5);

    const rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // verify payment
    const pay = await rzp.payments.fetch(paymentId);
    if (!pay) return res.status(400).json({ error: "payment_not_found" });

    // Accept "captured" or "authorized" (useful in test)
    if (!["captured", "authorized"].includes(pay.status)) {
      return res.status(400).json({ error: "payment_not_captured" });
    }

    // basic amount check
    if ((pay.amount || 0) < expectedInr * 100) {
      return res.status(400).json({ error: "amount_too_low" });
    }

    const now = Math.floor(Date.now() / 1000);
    const token = signToken({
      v: 1,
      kind: "compute",
      product: key,
      minutes: m,
      email: (email || "").trim(),
      pay_id: paymentId,
      iat: now,
      exp: now + 7 * 24 * 3600, // 7 days redemption window
    });

    return res.json({ token });
  } catch (e) {
    console.error("compute/mint error", e);
    return res.status(500).json({ error: "token_mint_failed" });
  }
}
