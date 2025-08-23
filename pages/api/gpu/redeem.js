// pages/api/gpu/redeem.js
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

function b64urlToUtf8(b64) {
  let s = (b64 || "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64").toString("utf8");
}

function parseV1Token(token) {
  if (typeof token !== "string" || !token.startsWith("v1.")) {
    return { error: "bad_token_format" };
  }
  const parts = token.slice(3).split(".");
  // supports:
  //   v1.<payload>
  //   v1.<payload>.<sig>
  //   v1.<header>.<payload>[.<sig>]
  let payloadPart;
  if (parts.length === 1) payloadPart = parts[0];
  else if (parts.length === 2) payloadPart = parts[0];
  else payloadPart = parts[1];
  try {
    return { payload: JSON.parse(b64urlToUtf8(payloadPart)) };
  } catch {
    return { error: "bad_token_payload" };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ ok: false, error: "kv_not_configured" });
  }

  try {
    const { token } = req.body || {};
    const { payload, error } = parseV1Token(token);
    if (error) return res.status(400).json({ ok: false, error });

    const email   = (payload.email || "").trim();
    const product = String(payload.product || payload.sku || "sd").toLowerCase();
    const promo   = (payload.promo || "").trim();
    const mRaw    = parseInt(payload.minutes, 10);
    const minutes = Math.min(480, Math.max(1, isNaN(mRaw) ? 1 : mRaw));

    // Map GPU product to your existing worker SKU (your worker runs "generic")
    const sku = ["sd", "whisper", "llama"].includes(product) ? "generic" : product;

    const now   = Date.now();
    const jobId = `job_${now}_${Math.random().toString(16).slice(2, 8)}`;

    const job = {
      id: jobId, kind: "compute", product: sku, minutes,
      token, email, promo, enqueuedAt: now,
    };
    const statusDoc = {
      ok: true, id: jobId, status: "queued", sku, minutes, email,
      createdAt: now, message: "queued via redeem (gpu)",
    };

    const headers = { Authorization: `Bearer ${KV_TOKEN}` };

    const q = await fetch(`${KV_URL}/lpush/compute:queue/${encodeURIComponent(JSON.stringify(job))}`, {
      method: "POST", headers,
    });
    if (!q.ok) return res.status(500).json({ ok: false, error: "kv_lpush_failed", detail: await q.text() });

    const s = await fetch(`${KV_URL}/set/compute:status:${jobId}/${encodeURIComponent(JSON.stringify(statusDoc))}`, {
      method: "POST", headers,
    });
    if (!s.ok) return res.status(500).json({ ok: false, error: "kv_set_failed", detail: await s.text() });

    return res.status(200).json({ ok: true, queued: true, id: jobId });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", detail: String(e?.message || e) });
  }
}
