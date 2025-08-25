// pages/api/gpu/pick.js
export const config = { api: { bodyParser: true } };

const KV_URL   = process.env.KV_URL;
const KV_TOKEN = process.env.KV_TOKEN;

// Comma-separated list of provider keys that GPU workers use in the Authorization header
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

  const { caps = {}, kind } = (req.body || {});
  const wantGpu = (String(kind || "gpu").toLowerCase() === "gpu")
               || (Array.isArray(caps.kinds) && caps.kinds.includes("gpu"));
  if (!wantGpu) return res.status(200).json({ ok:true, job:null });

  const authH = { Authorization: `Bearer ${KV_TOKEN}` };

  // FIFO pop: redeem does LPUSH, so we RPOP here
  const r = await fetch(`${KV_URL}/rpop/gpu:queue`, { method:"POST", headers:authH });
  const j = await r.json().catch(() => ({}));
  const rawJob = j?.result;
  if (!rawJob) return res.status(200).json({ ok:true, job:null });

  let job;
  try { job = JSON.parse(rawJob); } catch { job = rawJob; }

  const workerSkus = (caps.skus || []).map(s => String(s).toLowerCase());
  const sku = String(job.product || "gpu").toLowerCase();
  if (workerSkus.length && !workerSkus.includes(sku) && !workerSkus.includes("gpu")) {
    // not a match → push back and return no job
    await fetch(`${KV_URL}/lpush/gpu:queue/${encodeURIComponent(rawJob)}`, {
      method:"POST", headers:authH
    });
    return res.status(200).json({ ok:true, job:null });
  }

  const minutes = Math.max(1, Number(job.minutes || 60));
  const resp = { ok:true, job: { id: job.id, kind:"gpu", sku, minutes, email: job.email || "", pickedAt: Date.now() } };

  // optional status update
  const status = {
    ok:true, status:"picked", sku, minutes, email: resp.job.email,
    pickedAt: resp.job.pickedAt, message:"assigned to gpu provider"
  };
  await fetch(`${KV_URL}/set/gpu:status:${job.id}/${encodeURIComponent(JSON.stringify(status))}`,
    { method:"POST", headers:authH });

  return res.status(200).json(resp);
}
