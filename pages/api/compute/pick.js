// pages/api/compute/pick.js
// POST (auth via x-provider-key) -> returns { ok:true, job } or { ok:true, job:null }

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const PROVIDER_KEY = process.env.PROVIDER_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || "Indianode <no-reply@indianode.com>";
const BASE_URL = process.env.BASE_URL || "https://www.indianode.com";

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
    const popped = await kv("LPOP", "compute:queue");
    const id = popped?.result;
    if (!id) return res.status(200).json({ ok: true, job: null });

    const r = await kv("GET", `compute:job:${id}`);
    const job = JSON.parse(r?.result || "{}");

    const { publicHost = "", providerName = "default" } = await req.json?.() || req.body || {};
    job.status = "running";
    job.provider = providerName;
    job.public_host = publicHost || job.public_host || null;
    job.started_at = Date.now();

    await kv("SET", `compute:job:${id}`, JSON.stringify(job), "EX", 60 * 60 * 24 * 7);

    // Email user: started
    if (RESEND_API_KEY && job.email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: MAIL_FROM,
          to: job.email,
          subject: `Started: ${job.product} • ${job.minutes} min`,
          text: `Your job has started.\n\nJob ID: ${id}\nStatus: ${BASE_URL}/api/compute/status?id=${id}`,
        }),
      });
    }

    return res.status(200).json({ ok: true, job });
  } catch {
    return res.status(500).json({ ok: false, error: "pick_failed" });
  }
}
