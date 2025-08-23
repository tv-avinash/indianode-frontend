// pages/api/compute/mint.js
import crypto from "crypto";

export const config = { api: { bodyParser: true }, runtime: "nodejs" };

// price table if you want to sanity-check amounts later (optional)
const PRICE60 = { cpu2x4: 60, cpu4x8: 100, cpu8x16: 180, redis: 80, nginx: 40, generic: 30 };

function b64url(s) { return Buffer.from(s).toString("base64url"); }

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const b = (typeof req.body === "object" && req.body) ? req.body : {};
  const paymentId = String(b.paymentId || "").trim();
  const sku = String(b.sku || b.product || "").trim();
  const minutes = Math.max(1, Number(b.minutes || 1));
  const email = (b.email || "").trim();
  const promo = (b.promo || "").trim();

  if (!paymentId) return res.status(400).json({ ok: false, error: "missing_payment_id" });
  if (!sku)       return res.status(400).json({ ok: false, error: "missing_sku" });

  // TODO: (optional) verify Razorpay payment server-side

  const now = Date.now();
  const payload = { v: 1, kind: "compute", sku, minutes, email, pay_id: paymentId, promo, iat: now, exp: now + 7*24*3600*1000 };
  const body = b64url(JSON.stringify(payload));

  const secret = process.env.COMPUTE_ORDER_TOKEN_SECRET || process.env.ORDER_TOKEN_SECRET;
  const sig = secret ? crypto.createHmac("sha256", secret).update(body).digest("base64url") : "sig";
  const token = `v1.${body}.${sig}`;

  return res.status(200).json({ ok: true, token });
}
