// pages/api/compute/mint.js
function b64url(s){ return Buffer.from(s).toString("base64url"); }

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"method_not_allowed" });

  const b = (typeof req.body === "object" && req.body) ? req.body : {};
  const paymentId = String(b.paymentId || "").trim();
  const sku = String(b.sku || b.product || "").trim();
  const minutes = Math.max(1, Number(b.minutes || 1));
  const email = (b.email || "").trim();
  const promo = (b.promo || "").trim();

  if (!paymentId) return res.status(400).json({ ok:false, error:"missing_payment_id" });
  if (!sku)       return res.status(400).json({ ok:false, error:"missing_sku" });

  // TODO: verify Razorpay payment server-side

  const payload = { v:1, kind:"compute", sku, minutes, email, pay_id:paymentId, promo, iat:Date.now(), exp:Date.now()+7*24*3600*1000 };
  // Sign if you want; for now opaque token (header.payload.signature-like)
  const token = `v1.${b64url(JSON.stringify(payload))}.sig`;

  return res.status(200).json({ ok:true, token });
}
