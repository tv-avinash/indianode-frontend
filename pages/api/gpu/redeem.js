// pages/api/gpu/redeem.js
// Accept GPU ORDER_TOKEN and enqueue into the *compute* queue
// so your existing worker (polling /api/compute/pick) will run it.

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
  const rest = token.slice(3);
  const parts = rest.split(".");
  // Supported shapes:
  // 1) v1.<payload>
  // 2) v1.<payload>.<sig>
  // 3) v1.<header>.<payload>[.<sig>]
  let payloadPart;
  if (parts.length === 1) payloadPart = parts[0];
  else if (parts.length === 2) payloadPart = parts[0];       // payload.sig
  else if (parts.length >= 3) payloadPart = parts[1];        // header.payload.[sig]
  try {
    const json = b64urlToUtf8(payloadPart);
    return { payload: JSON.parse(json) };
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
    if (error) {
      return res.status(400).json({ ok: false, error });
    }

    // Normalize expected fields
    const email   = (payload.email || "").trim();
    const product = String(payload.product || payload.sku || "sd").toLowerCase();
    const promo   = (payload.promo || "").trim();
    const mRaw    = parseInt(payload.minutes, 10);
    const minutes = Math.min(480, Math.max(1, isNaN(mRaw) ? 1 : mRaw));

    // Map GPU “product” to a worker SKU your current worker knows.
    // (Your worker currently runs placeholder for "generic".)
    const sku = ["sd", "whisper", "llama"].includes(product) ? "generic" : product;

    const now = Date.now();
    const jobId = `job_${now}_${Math.random().toString(16).slice(2, 8)}`;

    const job = {
      id: jobId,
      kind: "compute",
      product: sku,
      minutes,
      token,
      email,
      promo,
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

    const headers = { Authorization: `Bearer ${KV_TOKEN}` };

    // LPUSH compute:queue
    const lp = await fetch(`${KV_URL}/lpush/compute:queue/${encodeURIComponent(JSON.stringify(job))}`, {
      method: "POST",
      headers,
    });
    if (!lp.ok) {
      const t = await lp.text();
      return res.status(500).json({ ok: false, error: "kv_lpush_failed", detail: t });
    }

    // SET compute:status:<id>
    const sv = await fetch(
      `${KV_URL}/set/compute:status:${jobId}/${encodeURIComponent(JSON.stringify(statusDoc))}`,
      { method: "POST", headers }
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
