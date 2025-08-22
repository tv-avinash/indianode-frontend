export default async function handler(req, res) {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ ok: false, error: "missing_id" });

    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;
    if (!KV_URL || !KV_TOKEN) {
      return res.status(500).json({ ok: false, error: "kv_not_configured" });
    }

    const r = await fetch(`${KV_URL}/get/${encodeURIComponent(`job:${id}`)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      cache: "no-store",
    });
    const j = await r.json(); // { result: "<json string>" | null }
    if (!j || !j.result) {
      return res.status(200).json({ ok: false, error: "not_found" });
    }

    let job;
    try { job = JSON.parse(j.result); } catch { job = j.result; }
    return res.status(200).json({ ok: true, ...job });
  } catch {
    return res.status(500).json({ ok: false, error: "status_failed" });
  }
}
