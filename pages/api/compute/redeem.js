// pages/api/compute/redeem.js
import { kv } from "@vercel/kv";

function parseToken(t) {
  // Accepts v1.<h>.<p>.<s>; we parse payload without failing if signature missing.
  const parts = (t || "").split(".");
  if (parts.length < 4 || parts[0] !== "v1") return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[2].replace(/-/g,"+").replace(/_/g,"/"), "base64").toString("utf8"));
    return payload;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

    const { token } = req.body || {};
    if (!token) return res.status(400).json({ ok: false, error: "missing_token" });

    const PFX  = process.env.KV_PREFIX || "compute";
    const QKEY = `${PFX}:queue`;
    const SKEY = (id) => `${PFX}:status:${id}`;

    const p = parseToken(token);
    if (!p || p.kind !== "compute") {
      return res.status(400).json({ ok: false, error: "invalid_token" });
    }

    const id = `job_${Date.now()}_${Math.random().toString(16).slice(2,8)}`;
    const job = {
      id,
      kind: "compute",
      product: p.product || "generic",
      minutes: Math.max(1, Number(p.minutes || 1)),
      token,
      email: p.email || "",
      enqueuedAt: Date.now()
    };

    // queue (FIFO: LPUSH + RPOP)
    await kv.lpush(QKEY, JSON.stringify(job));
    await kv.set(SKEY(id), JSON.stringify({
      id,
      status: "queued",
      sku: job.product,
      minutes: job.minutes,
      email: job.email || "",
      createdAt: job.enqueuedAt,
      message: "queued via redeem"
    }), { ex: 7 * 24 * 3600 });

    return res.json({ ok: true, queued: true, id });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
