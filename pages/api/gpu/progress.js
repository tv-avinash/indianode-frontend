// pages/api/gpu/progress.js
export const config = { api: { bodyParser: true } };

const KV_URL   = process.env.KV_URL;
const KV_TOKEN = process.env.KV_TOKEN;
const GPU_PROVIDER_KEYS = (process.env.GPU_PROVIDER_KEYS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

function authProvider(req) {
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
  return GPU_PROVIDER_KEYS.includes(tok);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok:false, error:"method_not_allowed" });
  }
  if (!authProvider(req)) return res.status(401).json({ ok:false, error:"unauthorized" });
  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ ok:false, error:"kv_missing" });

  const { id, status="running", message="" } = req.body || {};
  if (!id) return res.status(400).json({ ok:false, error:"missing_id" });

  const authH = { Authorization: `Bearer ${KV_TOKEN}` };
  const r = await fetch(`${KV_URL}/get/gpu:status:${encodeURIComponent(id)}`, { method:"POST", headers:authH });
  const j = await r.json().catch(() => ({}));
  let doc = {};
  try { doc = JSON.parse(j?.result || "{}"); } catch {}

  const merged = { ...(doc||{}), ok:true, id, status, message, updatedAt: Date.now() };
  await fetch(`${KV_URL}/set/gpu:status:${id}/${encodeURIComponent(JSON.stringify(merged))}`,
    { method:"POST", headers:authH });

  return res.status(200).json({ ok:true });
}
