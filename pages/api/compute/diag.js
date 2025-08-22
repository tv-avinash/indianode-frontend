// pages/api/compute/diag.js
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    const PFX  = process.env.KV_PREFIX || "compute";
    const QKEY = `${PFX}:queue`;
    const url = process.env.KV_REST_API_URL || "";
    const host = url.replace(/^https?:\/\//, "");

    const llen = await kv.llen(QKEY);
    const sample = llen > 0 ? (await kv.lrange(QKEY, 0, Math.min(llen - 1, 4)))
      .map((x) => { try { const j = JSON.parse(x); return { id: j.id, sku: j.product, minutes: j.minutes }; } catch { return { raw: x?.slice(0,80) }; } })
      : [];

    res.json({ ok: true, redisHost: host, prefix: PFX, queueKey: QKEY, length: llen, sample });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
