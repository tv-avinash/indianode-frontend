// pages/api/compute/mint.js
import crypto from "crypto";

function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/=+$/,"").replace(/\+/g,"-").replace(/\//g,"_");
}
function signHS256(secret, data) {
  return b64url(crypto.createHmac("sha256", secret).update(data).digest());
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

    const { paymentId, sku, minutes = 1, email = "", promo = "" } = req.body || {};
    if (!paymentId || !sku) return res.status(400).json({ ok: false, error: "missing_params" });

    const keyId = process.env.RZP_KEY_ID;
    const keySecret = process.env.RZP_KEY_SECRET;
    if (!keyId || !keySecret) {
      return res.status(500).json({ ok: false, error: "razorpay_env_missing" });
    }

    // Verify payment
    const r = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: {
        "Authorization": "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64")
      }
    });
    const j = await r.json();
    if (!r.ok) {
      return res.status(400).json({ ok: false, error: j?.error?.description || "rzp_verify_failed" });
    }
    const status = j.status; // "captured" / "authorized" / etc.
    if (!(status === "captured" || status === "authorized")) {
      return res.status(400).json({ ok: false, error: `payment_not_captured (${status})` });
    }

    // Mint token
    const secret = process.env.ORDER_TOKEN_SECRET;
    if (!secret) return res.status(500).json({ ok: false, error: "missing_ORDER_TOKEN_SECRET" });

    const M = Math.max(1, Number(minutes || 1));
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 7 * 24 * 3600; // token valid 7 days to redeem

    const header = { alg: "HS256", typ: "OT1" };
    const payload = {
      v: 1,
      kind: "compute",
      product: sku,
      minutes: M,
      email,
      pay_id: paymentId,
      promo: (promo || "").toUpperCase(),
      iat, exp
    };

    const h = b64url(JSON.stringify(header));
    const p = b64url(JSON.stringify(payload));
    const sig = signHS256(secret, `${h}.${p}`);
    const token = `v1.${h}.${p}.${sig}`;

    return res.json({ ok: true, token });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
