// pages/api/razorpay/confirm.js
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  try {
    const {
      orderId,
      paymentId,
      signature,
      product,
      minutes,
      email,
      promo,
    } = req.body || {};

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: "missing_params" });
    }

    // --- Verify signature ---
    const secret = process.env.RAZORPAY_KEY_SECRET; // keep on server only
    if (!secret) return res.status(500).json({ error: "missing_key_secret" });

    const hmac = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (hmac !== signature) {
      return res.status(400).json({ error: "bad_signature" });
    }

    // --- At this point payment is legit. Kick off your deploy/queue ---
    // Example: call your backend/deployer (Render/Fly/K8s/etc.)
    const DEPLOYER_BASE = process.env.DEPLOYER_BASE || process.env.NEXT_PUBLIC_DEPLOYER_BASE;
    // ^ use one you already have configured; keep a server-only one if possible.

    let deployResp = { ok: true };
    let deployData = {};
    if (DEPLOYER_BASE) {
      const r = await fetch(`${DEPLOYER_BASE}/api/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product,
          minutes: Number(minutes || 60),
          email,
          promo: (promo || "").trim().toUpperCase(),
          source: "razorpay",
          paymentId,
          orderId,
        }),
      });
      deployResp.ok = r.ok;
      deployData = await r.json().catch(() => ({}));
    }

    // Respond with something the UI can show
    return res.status(200).json({
      status: "queued",
      jobId: deployData.jobId || null,
      url: deployData.url || null, // if your deployer returns a service URL, pass it back
      message:
        deployResp.ok
          ? "Deployment queued. We’ll email your link once it’s live."
          : "Payment verified. We’re processing your deployment.",
    });
  } catch (e) {
    console.error("confirm error", e);
    return res.status(500).json({ error: "server_error" });
  }
}
