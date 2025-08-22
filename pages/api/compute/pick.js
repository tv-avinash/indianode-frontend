// pages/api/compute/pick.js
import { kv } from "@vercel/kv";

function auth(req) {
  const h = req.headers["authorization"] || req.headers["Authorization"] || "";
  const x = req.headers["x-provider-key"] || req.headers["X-Provider-Key"] || "";
  const key = h.startsWith("Bearer ") ? h.slice(7) : (x || "");
  return key && key === process.env.PROVIDER_KEY;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
    if (!auth(req)) return res.status(401).json({ ok: false, error: "unauthorized" });

    const PFX  = process.env.KV_PREFIX || "compute";
    const QKEY = `${PFX}:queue`;
    const SKEY = (id) => `${PFX}:status:${id}`;

    const raw = await kv.rpop(QKEY);
    if (!raw) return res.json({ ok: true, job: null });

    let job;
    try { job = JSON.parse(raw); } catch { job = null; }
    if (!job || !job.id) return res.json({ ok: true, job: null });

    // set running status
    await kv.set(SKEY(job.id), JSON.stringify({
      id: job.id,
      status: "running",
      sku: job.product,
      minutes: job.minutes,
      email: job.email || "",
      startedAt: Date.now(),
      message: "picked by provider"
    }), { ex: 7 * 24 * 3600 });

    return res.json({ ok: true, job });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
