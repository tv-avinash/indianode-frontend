// pages/api/compute/status.js
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ ok: false, error: "missing_id" });

    const PFX  = process.env.KV_PREFIX || "compute";
    const SKEY = `${PFX}:status:${id}`;

    const raw = await kv.get(SKEY);
    if (!raw) return res.status(404).json({ ok: false, error: "not_found" });

    try {
      const obj = JSON.parse(raw);
      return res.json({ ok: true, ...obj });
    } catch {
      return res.json({ ok: true, id, status: "unknown" });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
