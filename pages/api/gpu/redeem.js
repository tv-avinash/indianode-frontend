// pages/api/gpu/redeem.js
import crypto from "crypto";

const ALLOWED = new Set(["whisper", "sd", "llama"]);

function b64urlToBuffer(s) {
  // base64url -> base64
  s = String(s).replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const SECRET =
    process.env.GPU_ORDER_TOKEN_SECRET || process.env.ORDER_TOKEN_SECRET;
  const KV_URL = process.env.KV_URL;
  const KV_TOKEN = process.env.KV_TOKEN;

  if (!SECRET) return res.status(500).json({ ok: false, error: "token_secret_missing" });
  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ ok: false, error: "kv_missing" });

  try {
    const { token } = req.body || {};
    if (!token || typeof token !== "string") {
      return res.status(400).json({ ok: false, error: "missing_token" });
    }

    // Expect v1.<payload>.<sig>
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "v1") {
      return res.status(400).json({ ok: false, error: "bad_token_format" });
    }

    // Verify signature
    let payload;
    try {
      const sigExpected = crypto
        .createHmac("sha256", SECRET)
        .update(parts[1])
        .digest("base64url");
      if (sigExpected !== parts[2]) {
        return res.status(400).json({ ok: false, error: "bad_token_signature" });
      }

      const body = b64urlToBuffer(parts[1]).toString("utf8");
      payload = JSON.parse(body);
    } catch {
      return res.status(400).json({ ok: false, error: "bad_token_format" });
    }

    // Accept both legacy (no kind) and new (kind: "gpu")
    const kind = payload.kind || "gpu";
    if (kind !== "gpu") {
      return res.status(400).json({ ok: false, error: "wrong_kind" });
    }

    const product = String(payload.product || "").toLowerCase();
    const minutes = Math.max(1, Math.min(240, Number(payload.minutes || 0)));
    if (!ALLOWED.has(product)) {
      return res.status(400).json({ ok: false, error: "invalid_product" });
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > Number(payload.exp)) {
      return res.status(400).json({ ok: false, error: "token_expired" });
    }

    // Queue GPU job
    const jobId = `job_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const job = {
      id: jobId,
      kind: "gpu",
      product,             // whisper | sd | llama
      minutes,
      token,               // original token (for audit)
      email: payload.email || "",
      enqueuedAt: Date.now(),
    };

    // Push to Upstash list: gpu:queue
    const push = await fetch(`${KV_URL}/rpush/gpu:queue`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([JSON.stringify(job)]),
    });
    const pushResp = await push.json().catch(() => null);
    if (!push.ok) {
      return res.status(500).json({ ok: false, error: "kv_push_failed", details: pushResp });
    }

    // Optional status key (best-effort)
    const statusObj = {
      status: "queued",
      sku: product,
      minutes,
      createdAt: job.enqueuedAt,
      message: "queued via redeem",
    };
    await fetch(
      `${KV_URL}/set/gpu:status:${jobId}/${encodeURIComponent(JSON.stringify(statusObj))}`,
      { method: "POST", headers: { Authorization: `Bearer ${KV_TOKEN}` } }
    ).catch(() => {});

    return res.status(200).json({ ok: true, queued: true, id: jobId });
  } catch (e) {
    console.error("gpu redeem error", e);
    return res.status(500).json({ ok: false, error: "redeem_exception", message: e.message });
  }
}
