// pages/api/compute/progress.js
// POST { id, pct?, message? } with x-provider-key
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const PROVIDER_KEY = process.env.PROVIDER_KEY;

async function kv(command, ...args) {
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ command, args }),
  });
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const key = req.headers["x-provider-key"];
  if (!key || key !== PROVIDER_KEY) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const { id, pct, message } = await req.json?.() || req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: "missing_id" });

    const r = await kv("GET", `compute:job:${id}`);
    const job = JSON.parse(r?.result || "{}");
    if (!job?.id) return res.status(404).json({ ok: false, error: "not_found" });

    job.progress = typeof pct === "number" ? Math.min(100, Math.max(0, pct)) : (job.progress ?? 0);
    if (message) {
      job.logs = job.logs || [];
      job.logs.push({ ts: Date.now(), message: String(message) });
    }
    await kv("SET", `compute:job:${id}`, JSON.stringify(job), "EX", 60 * 60 * 24 * 7);

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, error: "progress_failed" });
  }
}
