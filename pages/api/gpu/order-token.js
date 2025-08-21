// pages/api/gpu/order-token.js
import crypto from "crypto";

export const config = { api: { bodyParser: true } };

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
function hmacSHA256(key, data) {
  return crypto.createHmac("sha256", key).update(data).digest("hex");
}

function signTokenV1(secret, payloadObj) {
  const header = { alg: "HS256", typ: "JWT", v: 1 };
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(payloadObj));
  const signature = b64url(
    crypto.createHmac("sha256", secret).update(`${encHeader}.${encPayload}`).digest()
  );
  return `v1.${encHeader}.${encPayload}.${signature}`;
}

function verifyRazorpaySignature({ orderId, paymentId, signature, keySecret }) {
  const expected = hmacSHA256(keySecret, `${orderId}|${paymentId}`);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ""));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const {
    orderId,
    paymentId,
    signature, // razorpay_signature
    product,
    minutes,
    email,
    promo,
  } = req.body || {};

  // Basic validation
  const PRODUCTS = new Set(["whisper", "sd", "llama"]);
  const mins = Math.max(1, Math.min(240, parseInt(minutes || 60, 10)));

  if (!PRODUCTS.has(String(product))) {
    res.status(400).json({ error: "invalid_product" });
    return;
  }

  const TOKEN_SECRET = process.env.TOKEN_SECRET;
  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  if (!TOKEN_SECRET) {
    res.status(500).json({ error: "missing_env_TOKEN_SECRET" });
    return;
  }
  if (!RAZORPAY_KEY_SECRET) {
    res.status(500).json({ error: "missing_env_RAZORPAY_KEY_SECRET" });
    return;
  }

  // Enforce signature by default
  const testBypass =
    process.env.ENABLE_TEST_TOKENS === "1" && process.env.NODE_ENV !== "production";

  if (!testBypass) {
    if (!orderId || !paymentId || !signature) {
      res.status(400).json({ error: "missing_razorpay_params" });
      return;
    }
    const ok = verifyRazorpaySignature({
      orderId,
      paymentId,
      signature,
      keySecret: RAZORPAY_KEY_SECRET,
    });
    if (!ok) {
      res.status(401).json({ error: "invalid_signature" });
      return;
    }
  }

  // Token payload (expires in 7 days)
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    email: String(email || "").trim(),
    product: String(product),
    minutes: mins,
    promo: (promo || "").toString().toUpperCase() || undefined,
    iat: now,
    exp: now + 7 * 24 * 3600,
  };

  const token = signTokenV1(TOKEN_SECRET, payload);

  res.status(200).json({
    ok: true,
    token,
    message:
      "Token minted. You can start now (1-click) or use the command from the modal.",
  });
}
