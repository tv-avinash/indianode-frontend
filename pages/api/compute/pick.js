// pages/api/compute/pick.js
const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const PROVIDER = process.env.COMPUTE_PROVIDER_KEY || process.env.COMPUTE_PROVIDER_KEY;

function authOk(req) {
  const h = req.headers || {};
  const bearer = (h.authorization || "").replace(/^Bearer\s+/i, "");
  const xpk = h["x-provider-key"] || h["x-provider"] || "";
  const supplied = String(bearer || xpk || "");
  return (supplied && supplied === (process.env.COMPUTE_PROVIDER_KEY || ""));
}
async function kvLPop(key) {
  const r = await fetch(`${KV_URL}/lpop/${encodeURIComponent(key)}`, { method: "POST", headers: { Authorization: `Bearer ${KV_TOKEN}` }});
  const j = await r.json();
  return j?.result || null;
}
async function kvSet(key, val) {
  await fetch(`${KV_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(val)}`, { method:"POST", headers:{ Authorization:`Bearer ${KV_TOKEN}` }});
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"method_not_allowed" });
  if (!authOk(req)) return res.status(401).json({ ok:false, error:"unauthorized" });

  const raw = await kvLPop("compute:queue");
  if (!raw) return res.status(200).json({ ok:true, job:null });

  const job = JSON.parse(raw);
  const status = { ok:true, id:job.id, status:"running", sku:job.sku, minutes:job.minutes, email:job.email, startedAt:Date.now(), worker:req.headers["x-forwarded-for"] || "worker" };
  await kvSet(`compute:status:${job.id}`, JSON.stringify(status));

  return res.status(200).json({ ok:true, job });
}
