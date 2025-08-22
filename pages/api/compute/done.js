// pages/api/compute/done.js
// POST { id, ok, message? } with x-provider-key
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
    const { id, ok = true, message } = await req.json?.() || req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: "missing_id" });

    const r = await kv("GET", `compute:job:${id}`);
    const job = JSON.parse(r?.result || "{}");
    if (!job?.id) return res.status(404).json({ ok: false, error: "not_found" });

    job.status = ok ? "completed" : "failed";
    job.finished_at = Date.now();
    if (message) {
      job.logs = job.logs || [];
      job.logs.push({ ts: Date.now(), message: String(message) });
    }
    await kv("SET", `compute:job:${id}`, JSON.stringify(job), "EX", 60 * 60 * 24 * 7);

    // Email user: completed/failed
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
          subject: `${ok ? "Completed" : "Failed"}: ${job.product} • ${job.minutes} min`,
          text:
            `${ok ? "Your job completed successfully." : "Your job failed."}\n\n` +
            `Job ID: ${id}\nStatus: ${BASE_URL}/api/compute/status?id=${id}` +
            (message ? `\n\nMessage: ${message}` : ""),
        }),
      });
    }

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, error: "done_failed" });
  }
}
