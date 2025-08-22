// pages/api/compute/mint.js
import crypto from "crypto";

// --- helpers ---------------------------------------------------------------

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signOrderToken(secret, payload) {
  const header = { alg: "HS256", typ: "OT1" };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const sig = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `v1.${h}.${p}.${sig}`;
}

async function getRazorpayPayment(paymentId, keyId, keySecret) {
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const r = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`razorpay_fetch_failed_${r.status}_${text.slice(0,128)}`);
  }
  return r.json();
}

async function sendResendEmail({ apiKey, fromEmail, to, subject, html }) {
  if (!apiKey || !fromEmail || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
      }),
    });
  } catch {
    // don't fail mint if email fails
  }
}

// --- API route -------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  // env
  const {
    ORDER_TOKEN_SECRET,
    RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET,
    RESEND_API_KEY,
    FROM_EMAIL,
    NEXT_PUBLIC_DEPLOYER_BASE,
  } = process.env;

  // strong, explicit checks so you see clear errors instead of "no_token"
  if (!ORDER_TOKEN_SECRET)
    return res.status(500).json({ ok: false, error: "missing_ORDER_TOKEN_SECRET" });
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET)
    return res.status(500).json({ ok: false, error: "missing_razorpay_keys" });

  try {
    const { paymentId, product, minutes, email, promo } = req.body || {};

    if (!paymentId || typeof paymentId !== "string")
      return res.status(400).json({ ok: false, error: "missing_paymentId" });

    // Basic allowlist for SKUs (accept a few aliases)
    const aliases = {
      cpu2x4: "cpu2x4",
      "cpu2x4g": "cpu2x4",
      cpu4x8: "cpu4x8",
      cpu8x16: "cpu8x16",
      redis4: "redis4",
      "redis4g": "redis4",
      redis8: "redis8",
      "redis8g": "redis8",
      redis16: "redis16",
      "redis16g": "redis16",
    };
    const sku = aliases[String(product || "").toLowerCase()];
    if (!sku) return res.status(400).json({ ok: false, error: "invalid_product" });

    const mins = Math.max(1, Number(minutes || 1));

    // 1) Verify payment with Razorpay
    const pay = await getRazorpayPayment(paymentId, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET);
    // Accept captured (or authorized for test); tighten if you want
    const okStatus = pay.status === "captured" || pay.status === "authorized";
    if (!okStatus) {
      return res.status(402).json({ ok: false, error: `payment_not_captured_${pay.status}` });
    }

    // 2) Mint one-time ORDER_TOKEN
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 7 * 24 * 3600; // 7 days to redeem
    const payload = {
      v: 1,
      kind: "compute",
      product: sku,
      minutes: mins,
      email: (email || "").trim(),
      pay_id: paymentId,
      promo: (promo || "").trim() || undefined,
      iat: now,
      exp,
    };

    const token = signOrderToken(ORDER_TOKEN_SECRET, payload);

    // 3) (Optional) email instructions
    const base = NEXT_PUBLIC_DEPLOYER_BASE || "https://www.indianode.com";
    const runUrl = `${base}/api/compute/run.sh`;
    const html = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif">
        <h2>Indianode — Compute token ready</h2>
        <p>Your one-time ORDER_TOKEN has been minted for <b>${sku}</b> (${mins} min).</p>
        <p>Redeem from any machine (don’t run on your Akash host):</p>
        <pre style="background:#111;color:#fff;padding:12px;border-radius:8px;white-space:pre-wrap">
# macOS / Linux
curl -fsSL ${runUrl} | ORDER_TOKEN='${token}' bash

# Windows PowerShell
$env:ORDER_TOKEN='${token}'; iwr -useb ${runUrl} ^| iex

# Windows cmd.exe
set ORDER_TOKEN=${token} && curl -fsSL ${runUrl} ^| bash
        </pre>
        <p>We’ll email you when the job is picked up and when it completes.</p>
      </div>
    `.trim();

    await sendResendEmail({
      apiKey: RESEND_API_KEY,
      fromEmail: FROM_EMAIL,
      to: (email || "").trim(),
      subject: "Your Indianode compute token",
      html,
    });

    // 4) Return the token to the client
    return res.status(200).json({ ok: true, token });
  } catch (e) {
    console.error("mint_error", e);
    return res
      .status(500)
      .json({ ok: false, error: String(e?.message || e || "token_mint_failed") });
  }
}
