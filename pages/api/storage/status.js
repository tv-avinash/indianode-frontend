// pages/api/storage/status.js
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  try {
    const { id } = req.query || {};
    if (!id || typeof id !== "string") return res.status(400).json({ ok: false, error: "missing_id" });

    const KV_URL = process.env.KV_URL;
    const KV_TOKEN = process.env.KV_TOKEN;
    if (!KV_URL || !KV_TOKEN) return res.status(500).json({ ok: false, error: "kv_missing" });

    const r = await fetch(`${KV_URL}/get/storage:status:${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    const j = await r.json().catch(() => ({}));
    const raw = j?.result;
    if (!raw) return res.status(404).json({ ok: false, OK: false, error: "not_found" });

    let doc;
    try { doc = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { doc = raw; }
    return res.status(200).json({ ok: true, OK: true, id, ...doc });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "status_exception", message: e.message });
  }
}
