// pages/api/storage/order-token.js
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const { email, plan, ref } = req.body || {};
    if (!email || !plan || !ref) {
      return res.status(400).json({ error: "missing_params" });
    }

    const secret = process.env.ORDER_TOKEN_SECRET;
    if (!secret) {
      return res.status(500).json({ error: "server_not_configured" });
    }

    // Issue a short-lived token (1 week). Adjust as needed.
    const now = Math.floor(Date.now() / 1000);
    const payload = { v: 1, email, plan, ref, iat: now, exp: now + 7 * 24 * 3600 };

    // Compact JWT-like token: v1.<base64url(payload)>.<base64url(hmac)>
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    const token = `v1.${body}.${sig}`;

    return res.status(200).json({ token });
  } catch (e) {
    return res.status(500).json({ error: "server_error" });
  }
}
