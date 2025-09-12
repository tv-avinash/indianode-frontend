// pages/api/compute/mint.js
import crypto from "crypto";

export const config = { api: { bodyParser: true }, runtime: "nodejs" };

// Optional: use for sanity checks if you want to validate amounts later.
const PRICE60 = { cpu2x4: 60, cpu4x8: 120, cpu8x16: 240, redis: 80, nginx: 40, generic: 30 };

function b64url(s) { return Buffer.from(s).toString("base64url"); }
function calcAmountPaise(sku, minutes, promo) {
  const base = PRICE60[sku];
  if (!base) return null;
  const m = Math.max(1, Number(minutes || 1));
  let inr = Math.ceil((base / 60) * m);
  if (String(promo || "").trim().toUpperCase().startsWith("TRY")) {
    inr = Math.max(1, inr - 5);
  }
  return Math.max(100, inr * 100); // paise; Razorpay minimum ₹1
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const b = (typeof req.body === "object" && req.body) ? req.body : {};

    // From Razorpay Checkout handler
    const orderId  = String(b.orderId || b.razorpay_order_id || "").trim();
    const paymentId = String(b.paymentId || b.razorpay_payment_id || "").trim();
    const signature = String(b.razorpay_signature || "").trim();

    // Your product info
    const sku = String(b.sku || b.product || "").trim();
    const minutes = Math.max(1, Number(b.minutes || 1));
    const email = (b.email || "").trim();
    const promo = (b.promo || "").trim();

    if (!paymentId) return res.status(400).json({ ok: false, error: "missing_payment_id" });
    if (!sku)       return res.status(400).json({ ok: false, error: "missing_sku" });

    const KEY_ID = process.env.RZP_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const KEY_SECRET = process.env.RZP_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;

    // ---- 1) Verify signature if provided (recommended path)
    if (KEY_SECRET && orderId && signature) {
      const expected = crypto
        .createHmac("sha256", KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");
      if (expected !== signature) {
        return res.status(400).json({ ok: false, error: "signature_verification_failed" });
      }
    }

    // ---- 2) Query Razorpay to ensure the payment is CAPTURED
    if (KEY_ID && KEY_SECRET) {
      const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
      const pr = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
        method: "GET",
        headers: { Authorization: `Basic ${auth}` },
      });
      const pj = await pr.json();
      if (!pr.ok) {
        return res.status(502).json({ ok: false, error: "rzp_fetch_payment_failed", detail: pj });
      }

      // Status must be 'captured' (not just 'authorized').
      if (pj.status !== "captured") {
        // Don't refund here; just tell client to retry/poll.
        return res.status(409).json({ ok: false, error: "payment_not_captured_yet", status: pj.status });
      }

      // Optional: sanity check order/payment mapping & amount
      // if (orderId && pj.order_id && pj.order_id !== orderId) {
      //   return res.status(400).json({ ok: false, error: "order_payment_mismatch" });
      // }
      // const expectedPaise = calcAmountPaise(sku, minutes, promo);
      // if (expectedPaise && Math.abs(Number(pj.amount) - expectedPaise) > 0) {
      //   return res.status(400).json({ ok: false, error: "amount_mismatch" });
      // }
    } else {
      // If keys are missing we cannot verify—only allow in dev.
      // In prod, always set RZP_KEY_ID / RZP_KEY_SECRET.
    }

    // ---- 3) Mint an ORDER_TOKEN for your system
    const now = Date.now();
    const payload = {
      v: 1,
      kind: "compute",
      sku,
      minutes,
      email,
      pay_id: paymentId,
      order_id: orderId || null,
      promo,
      iat: now,
      exp: now + 7 * 24 * 3600 * 1000, // 7 days
    };
    const body = b64url(JSON.stringify(payload));

    const secret = process.env.COMPUTE_ORDER_TOKEN_SECRET || process.env.ORDER_TOKEN_SECRET;
    const sig = secret
      ? crypto.createHmac("sha256", secret).update(body).digest("base64url")
      : "sig";
    const token = `v1.${body}.${sig}`;

    return res.status(200).json({ ok: true, token });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", detail: String(e) });
  }
}
