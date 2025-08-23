// pages/api/gpu/redeem.js
// Accepts a GPU ORDER_TOKEN and enqueues a job into the *compute* queue
// so the existing worker (which polls /api/compute/pick) can run it.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

function b64urlToUtf8(b64) {
  let s = b64.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64").toString("utf8");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    if (!KV_URL || !KV_TOKEN) {
      return res.status(500).json({ ok: false, error: "kv_not_configured" });
    }

    const { token } = req.body || {};
    if (!token || typeof token !== "string" || !token.startsWith("v1.")) {
      return res.status(400).json({ ok: false, error: "bad_token_format" });
    }

    // Handle both shapes:
    //  - "v1.<payload>"
    //  - "v1.<header>.<payload>[.<sig>]"
    const rest = token.slice(3); // after "v1."
    const parts = rest.split(".");
    let payloadPart = rest;
    if (parts.length >= 2) {
      payloadPart = parts[parts.length - 1]; // last piece is payload in JWS-like shapes
    }

    let payload;
    try {
      payload = JSON.parse(b64urlToUtf8(payloadPart));
    } catch {
      return res.status(400).json({ ok: false, error: "bad_token_payload" });
    }

    // Normalize fields
    const email = (payload.email || "").trim();
    const product = String(payload.product || payload.sku || "sd").toLowerCase();
    const minutesRaw = parseInt(payload.minutes, 10);
    const minutes = Math.min(480, Math.max(1, isNaN(minutesRaw) ? 1 : minutesRaw));
    const promo = (payload.promo || "").trim();

    // Your worker accepts sku "generic" (and others if you add them).
    // For now we keep it simple and run the placeholder workload.
    const sku = ["sd", "whisper", "llama"].includes(product) ? "generic" : product;

    const now = Date.now();
    const jobId = `job_${now}_${Math.random().toString(16).slice(2, 8)}`;

    // Prepare job & initial status doc
    const job = {
      id: jobId,
      kind: "compute",            // reuse compute queue
      product: sku,
      minutes,
      token,
      email,
      enqueuedAt: now,
    };

    const statusDoc = {
      ok: true,
      id: jobId,
      status: "queued",
      sku,
      minutes,
      email,
      createdAt: now,
      message: "queued via redeem (gpu)",
    };

    // Enqueue to compute queue so existing worker picks it up
    const auth = { Authorization: `Bearer ${KV_TOKEN}` };

    // LPUSH compute:queue
    const lp = await fetch(`${KV_URL}/lpush/compute:queue/${encodeURIComponent(JSON.stringify(job))}`, {
      method: "POST",
      headers: auth,
    });
    if (!lp.ok) {
      const t = await lp.text();
      return res.status(500).json({ ok: false, error: "kv_lpush_failed", detail: t });
    }

    // SET status
    const sv = await fetch(
      `${KV_URL}/set/compute:status:${jobId}/${encodeURIComponent(JSON.stringify(statusDoc))}`,
      { method: "POST", headers: auth }
    );
    if (!sv.ok) {
      const t = await sv.text();
      return res.status(500).json({ ok: false, error: "kv_set_failed", detail: t });
    }

    return res.status(200).json({ ok: true, queued: true, id: jobId });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", detail: String(e?.message || e) });
  }
}
