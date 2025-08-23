// pages/api/compute/redeem.js
const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const RESEND   = process.env.RESEND_API_KEY || "";

async function kvSet(key, value) {
  await fetch(`${KV_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
}
async function kvRPush(key, value) {
  await fetch(`${KV_URL}/rpush/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
}

function decodeToken(tok) {
  try {
    const parts = String(tok).split(".");
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json);
  } catch { return null; }
}

async function sendEmail(to, subject, html) {
  if (!RESEND || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND}` },
      body: JSON.stringify({ from: "Indianode <notify@mail.indianode.com>", to, subject, html })
    });
  } catch {}
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"method_not_allowed" });

  const token = String(req.body?.token || process.env.ORDER_TOKEN || "").trim();
  if (!token) return res.status(400).json({ ok:false, error:"missing_token" });

  const data = decodeToken(token);
  if (!data || data.kind !== "compute") return res.status(400).json({ ok:false, error:"bad_token" });

  const id = `job_${Date.now()}_${Math.random().toString(16).slice(2,8)}`;
  const job = { id, kind:"compute", sku:data.sku || data.product || "generic", minutes: Number(data.minutes || 1), token, email: data.email || "", enqueuedAt: Date.now() };

  await kvRPush("compute:queue", JSON.stringify(job));
  await kvSet(`compute:status:${id}`, JSON.stringify({ ok:true, id, status:"queued", sku:job.sku, minutes:job.minutes, email:job.email, createdAt:job.enqueuedAt, message:"queued via redeem" }));

  await sendEmail(job.email, "Job queued", `<p>Your job <b>${id}</b> is queued for ${job.minutes} min on ${job.sku}.</p>`).catch(()=>{});

  return res.status(200).json({ ok:true, queued:true, id });
}
