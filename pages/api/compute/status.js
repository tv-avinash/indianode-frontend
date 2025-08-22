// pages/api/compute/status.js
// GET /api/compute/status?id=job_...
// Returns { ok:true, job:{...} } or 404 if not found.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kv(command, ...args) {
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ command, args }),
    cache: "no-store",
  });
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const id = (req.query.id || "").toString().trim();
  if (!id) return res.status(400).json({ ok: false, error: "missing_id" });

  try {
    const r = await kv("GET", `compute:job:${id}`);
    const raw = r?.result;
    if (!raw) return res.status(404).json({ ok: false, error: "not_found" });

    const job = typeof raw === "string" ? JSON.parse(raw) : raw;
    return res.status(200).json({ ok: true, job });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "kv_error" });
  }
}
