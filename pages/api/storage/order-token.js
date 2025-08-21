// pages/api/storage/order-token.js
import crypto from "crypto";

// Helpers
function inrToPaise(x) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// Choose a non-empty value from a list (treat "" as absent)
function pick(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

// Expected price per plan (in paise). Supports legacy single-price env.
function expectedPricePaise(plan) {
  const legacy = process.env.PRELOAD_PRICE_INR; // legacy single price (INR)

  const p200 = pick(process.env.PRELOAD_PRICE_200_INR, legacy, "499");
  const p500 = pick(process.env.PRELOAD_PRICE_500_INR, legacy, "799");
  const p1tb = pick(process.env.PRELOAD_PRICE_1TB_INR, legacy, "1199");

  let chosen;
  if (plan === "200Gi") chosen = p200;
  else if (plan === "500Gi") chosen = p500;
  else if (plan === "1TiB") chosen = p1tb;
  else chosen = pick(legacy, "499");

  return inrToPaise(chosen);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const { email, plan, ref } = req.body || {};
    if (!email || !plan || !ref) return res.status(400).json({ error: "missing_params" });
    if (!["200Gi", "500Gi", "1TiB"].includes(plan)) return res.status(400).json({ error: "invalid_plan" });
    if (!/^pay_[a-zA-Z0-9]+$/.test(ref)) return res.status(400).json({ error: "invalid_payment_id" });

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const tokenSecret = process.env.ORDER_TOKEN_SECRET;
    if (!keyId || !keySecret || !tokenSecret) {
      return res.status(500).json({ error: "server_not_configured" });
    }

    // Lookup payment on Razorpay (works in Test Mode with test keys)
    const basic = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rsp = await fetch(`https://api.razorpay.com/v1/payments/${ref}`, {
      headers: { Authorization: `Basic ${basic}` },
    });

    const text = await rsp.text();
    let payment;
    try {
      payment = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: "invalid_gateway_response", raw: text.slice(0, 200) });
    }
    if (!rsp.ok) {
      return res.status(402).json({
        error: "payment_lookup_failed",
        details: payment?.error?.description || "razorpay_error",
      });
    }

    // Validate status/currency/amount
    if (payment.status !== "captured") return res.status(402).json({ error: "payment_not_captured" });
    if (payment.currency !== "INR") return res.status(402).json({ error: "currency_mismatch" });

    const expected = expectedPricePaise(plan);
    if (!(Number(payment.amount) >= expected)) {
      return res.status(402).json({ error: "amount_too_low", got: payment.amount, expected });
    }

    // Issue compact ORDER_TOKEN
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      v: 1,
      email,
      plan,                // "200Gi" | "500Gi" | "1TiB"
      ref: payment.id,     // canonical payment id
      amt: payment.amount,
      cur: payment.currency,
      iat: now,
      exp: now + 7 * 24 * 3600, // 7 days
    };

    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", process.env.ORDER_TOKEN_SECRET)
      .update(body)
      .digest("base64url");

    const orderToken = `v1.${body}.${sig}`;
    return res.status(200).json({ token: orderToken });
  } catch {
    return res.status(500).json({ error: "server_error" });
  }
}
