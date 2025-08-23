// pages/api/gpu/mint.js
import crypto from "crypto";

const PRICE60 = { whisper: 100, sd: 200, llama: 300 }; // ₹ base for 60 min
const TEST_ALLOW_ANY = String(process.env.GPU_MINT_TEST_ALLOW_ANY || "0") === "1";

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
      minutes,
      email = "",
      promo = "",
    } = req.body || {};

    const payId = paymentId || razorpayPaymentId;
    const prod = String(product || "").toLowerCase();
    const mins = Math.max(1, Math.min(240, Number(minutes || 60)));

    if (!PRICE60[prod]) {
      return res.status(400).json({ error: "invalid_product" });
    }
    if (!TEST_ALLOW_ANY && !payId) {
      return res.status(400).json({ error: "missing_payment_id" });
    }

    // ---- Verify Razorpay payment (skipped in test mode) ----
    if (!TEST_ALLOW_ANY) {
      const key = process.env.RAZORPAY_KEY_ID;
      const secretKey = process.env.RAZORPAY_KEY_SECRET;
      if (!key || !secretKey) {
        return res.status(500).json({ error: "razorpay_keys_missing" });
      }

      const auth = "Basic " + Buffer.from(`${key}:${secretKey}`).toString("base64");
      const rp = await fetch(`https://api.razorpay.com/v1/payments/${payId}`, {
        headers: { Authorization: auth },
      });

      const pdata = await rp.json().catch(() => null);
      if (!rp.ok) {
        return res
          .status(400)
          .json({ error: "razorpay_fetch_failed", details: pdata });
      }
      if (pdata.status !== "captured") {
        return res
          .status(400)
          .json({ error: "payment_not_captured", status: pdata.status });
      }

      // Amount sanity check (>= expected for product x minutes)
      const baseInr = PRICE60[prod];
      let expectedInr = Math.ceil((baseInr / 60) * mins);
      const code = String(promo || "").trim().toUpperCase();
      if (code === "TRY" || code === "TRY10") {
        expectedInr = Math.max(1, expectedInr - 5);
      }

      const paidInr = (pdata.amount || 0) / 100;
      if (paidInr + 1e-4 < expectedInr) {
        return res
          .status(400)
          .json({ error: "amount_too_low", expectedInr, paidInr });
      }
    }

    // ---- Mint ORDER_TOKEN (HMAC, JWT-ish) ----
    const signSecret =
      process.env.GPU_ORDER_TOKEN_SECRET || process.env.ORDER_TOKEN_SECRET;
    if (!signSecret) {
      return res.status(500).json({ error: "token_secret_missing" });
    }

    const now = Math.floor(Date.now() / 1000);

    // IMPORTANT: include kind: "gpu" so /api/gpu/redeem accepts the format
    const payload = {
      v: 1,
      kind: "gpu",
      product: prod,         // "whisper" | "sd" | "llama"
      minutes: mins,
      email,
      pay: payId || "test",
      promo: String(promo || "").trim() || undefined,
      iat: now,
      exp: now + 7 * 24 * 3600, // redeem within 7 days
    };

    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto
      .createHmac("sha256", signSecret)
      .update(body)
      .digest("base64url");

    const token = `v1.${body}.${sig}`;

    return res.status(200).json({ token });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "mint_exception", message: e.message });
  }
}
