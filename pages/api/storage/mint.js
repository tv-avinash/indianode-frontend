// pages/api/storage/mint.js
import crypto from "crypto";

export const config = { api: { bodyParser: true } };

const PRICE60 = { nvme200: 49, nvme500: 99, nvme1tb: 149 };
const SIZE_GI = { nvme200: 200, nvme500: 500, nvme1tb: 1024 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const { paymentId, product, minutes, email = "", promo = "" } = req.body || {};
    const prod = String(product || "").toLowerCase();
    const mins = Math.max(1, Math.min(240, Number(minutes || 60)));

    if (!PRICE60[prod]) return res.status(400).json({ error: "invalid_product" });

    const key = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key || !secret) return res.status(500).json({ error: "razorpay_keys_missing" });

    if (!paymentId) return res.status(400).json({ error: "missing_payment_id" });

    // Verify payment is captured
    const auth = "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
    const rp = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: { Authorization: auth },
    });
    const pdata = await rp.json().catch(() => null);
    if (!rp.ok) return res.status(400).json({ error: "razorpay_fetch_failed", details: pdata });
    if (pdata.status !== "captured")
      return res.status(400).json({ error: "payment_not_captured", status: pdata.status });

    // Amount check (>= expected)
    const base = PRICE60[prod];
    let expectedInr = Math.ceil((base / 60) * mins);
    const code = String(promo || "").trim().toUpperCase();
    if (code === "TRY" || code === "TRY10") expectedInr = Math.max(1, expectedInr - 5);

    const paidInr = (pdata.amount || 0) / 100;
    if (paidInr + 1e-4 < expectedInr) {
      return res.status(400).json({ error: "amount_too_low", expectedInr, paidInr });
    }

    // Mint token (HMAC, v1.<payload>.<sig>)
    const signSecret =
      process.env.STORAGE_ORDER_TOKEN_SECRET ||
      process.env.ORDER_TOKEN_SECRET ||
      process.env.GPU_ORDER_TOKEN_SECRET; // fall back if you share one secret
    if (!signSecret) return res.status(500).json({ error: "token_secret_missing" });

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      v: 1,
      kind: "storage",
      product: prod,
      sizeGi: SIZE_GI[prod],
      minutes: mins,
      email,
      pay: paymentId,
      promo: code || undefined,
      iat: now,
      exp: now + 7 * 24 * 3600,
    };

    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", signSecret).update(body).digest("base64url");
    const token = `v1.${body}.${sig}`;

    return res.status(200).json({ token });
  } catch (e) {
    console.error("[storage/mint]", e);
    return res.status(500).json({ error: "mint_exception", message: e.message });
  }
}
