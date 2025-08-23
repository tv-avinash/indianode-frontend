// pages/api/compute/status.js
const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  const j = await r.json();
  return j?.result || null;
}

export default async function handler(req, res) {
  const id = String(req.query?.id || "").trim();
  if (!id) return res.status(400).json({ ok:false, error:"missing_id" });

  const raw = await kvGet(`compute:status:${id}`);
  if (!raw) return res.status(200).json({ ok:false, error:"not_found" });

  try { return res.status(200).json(JSON.parse(raw)); }
  catch { return res.status(200).json({ ok:false, error:"corrupt" }); }
}
