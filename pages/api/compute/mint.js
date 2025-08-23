// pages/api/compute/mint.js
import crypto from "crypto";

export const config = { api: { bodyParser: true }, runtime: "nodejs" };

// 60-minute base prices (₹) — match your UI
const PRICE60 = {
  cpu2x4: 60,
  cpu4x8: 100,
  cpu8x16: 180,
  redis: 80,
  nginx: 40,
  generic: 30,
};

// Set COMPUTE_MINT_TEST_ALLOW_ANY=1 to bypass Razorpay for testing
const TEST_ALLOW_ANY =
  String(process.env.COMPUTE_MINT_TEST_ALLOW_ANY || "0") === "1";

function priceInr(prod, mins, promo) {
  const base = PRICE60[prod] || 0;
  const m = Math.max(1, Number(mins || 60));
  let total = Math.ceil((base / 60) * m);
  const code = String(promo || "").trim().toUpperCase();
  if (code === "TRY" || code === "TRY10") total = Math.max(1, total - 5);
  return total;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const {
      paymentId,
      razorpayPaymentId,
      product,
      sku,
      minutes,
      email = "",
      promo = "",
    } = (req.body || {});

    const prod = String(product || sku || "").toLowerCase();
    const mins = Math.max(1, Math.min(480, Number(minutes || 60)));
    const payId = (paymentId || razorpayPaymentId || "").trim();

    if (!PRICE60[prod]) return res.status(400).json({ error: "invalid_product" });
    if (!TEST_ALLOW_ANY && !payId)
      return res.status(400).json({ error: "missing_payment_id" });

    // ---- Optional: verify Razorpay payment (skipped in test mode) ----
    if (!TEST_ALLOW_ANY) {
      const KEY_ID =
        process.env.RAZORPAY_KEY_ID || process.env.RZP_KEY_ID || "";
      const KEY_SECRET =
        process.env.RAZORPAY_KEY_SECRET || process.env.RZP_KEY_SECRET || "";
      if (!KEY_ID || !KEY_SECRET) {
        return res.status(500).json({ error: "razorpay_keys_missing" });
      }

      const auth = "Basic " + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
      const r = await fetch(`https://api.razorpay.com/v1/payments/${payId}`, {
        headers: { Authorization: auth },
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) return res.status(400).json({ error: "razorpay_fetch_failed", details: j });
      if (j.status !== "captured") {
        return res.status(400).json({ error: "payment_not_captured", status: j.status });
      }

      // floor-check against expected ₹
      const expectedInr = priceInr(prod, mins, promo);
      const paidInr = (j.amount || 0) / 100;
      if (paidInr + 1e-4 < expectedInr) {
        return res.status(400).json({ error: "amount_too_low", expectedInr, paidInr });
      }
    }

    // ---- Mint ORDER_TOKEN (HMAC) ----
    const secret = process.env.ORDER_TOKEN_SECRET;
    if (!secret) return res.status(500).json({ error: "token_secret_missing" });

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      v: 1,
      kind: "compute",
      sku: prod,
      product: prod,         // keep both keys for compatibility
      minutes: mins,
      email,
      pay_id: payId || "test",
      promo: (promo || "").trim(),
      iat: now,
      exp: now + 7 * 24 * 3600, // 7d to redeem
    };

    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    const token = `v1.${body}.${sig}`;

    return res.status(200).json({ ok: true, token });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "mint_exception", message: e.message });
  }
}
