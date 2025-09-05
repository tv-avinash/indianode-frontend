// pages/api/storage/pick.js
// Pops one storage job from the queue.
// Expects: Authorization: Bearer <PROVIDER_KEY>
// Uses Upstash/Vercel KV via REST so we don't need local lib helpers.

const QUEUE_KEY = "compute:queue:storage";

// Accept either PROVIDER_KEYS (comma-separated) or single PROVIDER_KEY
function isAuthorized(req) {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = (m && m[1]) || "";
  const keys = String(process.env.PROVIDER_KEYS || process.env.PROVIDER_KEY || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return token && keys.includes(token);
}

// Minimal KV client over Upstash REST (works on Vercel, Node runtime)
const KV_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  ""; // accept either var name
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  "";

async function kvLLen(key) {
  const r = await fetch(`${KV_URL}/llen/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`llen http=${r.status}`);
  const j = await r.json();
  return j.result ?? 0;
}

async function kvRPop(key) {
  const r = await fetch(`${KV_URL}/rpop/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`rpop http=${r.status}`);
  const j = await r.json();
  return j.result ?? null; // string or null
}

// Optional: tiny fingerprint for logs
function kvFingerprint() {
  return {
    runtime: "nodejs",
    url_hash: KV_URL ? String(KV_URL).slice(-8) : "",
    token_hash: KV_TOKEN ? String(KV_TOKEN).slice(-8) : "",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  if (!KV_URL || !KV_TOKEN) {
    return res
      .status(500)
      .json({ ok: false, error: "KV not configured (KV_REST_API_URL/TOKEN)" });
  }

  try {
    const lenBefore = await kvLLen(QUEUE_KEY);
    const raw = await kvRPop(QUEUE_KEY);
    const lenAfter = await kvLLen(QUEUE_KEY);

    let job = null;
    if (raw) {
      try {
        job = JSON.parse(raw);
      } catch {
        // if someone enqueued a plain string
        job = { raw };
      }
    }

    return res.status(200).json({
      ok: true,
      job: job || null,
      lenBefore,
      lenAfter,
      kvfp: kvFingerprint(),
    });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: e.message || "kv_error_unexpected" });
  }
}
