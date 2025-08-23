// pages/api/compute/progress.js
const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

function authOk(req) {
  const h = req.headers || {};
  const bearer = (h.authorization || "").replace(/^Bearer\s+/i, "");
  const xpk = h["x-provider-key"] || "";
  const supplied = String(bearer || xpk || "");
  return (supplied && supplied === (process.env.COMPUTE_PROVIDER_KEY || ""));
}
async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, { method:"POST", headers:{ Authorization:`Bearer ${KV_TOKEN}` }});
  const j = await r.json(); return j?.result || null;
}
async function kvSet(key, val) {
  await fetch(`${KV_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(val)}`, { method:"POST", headers:{ Authorization:`Bearer ${KV_TOKEN}` }});
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"method_not_allowed" });
  if (!authOk(req)) return res.status(401).json({ ok:false, error:"unauthorized" });

  const { id, status, message, eta } = req.body || {};
  if (!id) return res.status(400).json({ ok:false, error:"missing_id" });

  const raw = await kvGet(`compute:status:${id}`);
  if (!raw) return res.status(404).json({ ok:false, error:"not_found" });

  const cur = JSON.parse(raw);
  if (status) cur.status = status;
  if (message) cur.message = message;
  if (eta) cur.eta = eta;
  cur.ts = Date.now();

  await kvSet(`compute:status:${id}`, JSON.stringify(cur));
  return res.status(200).json({ ok:true });
}
