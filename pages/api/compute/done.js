// pages/api/compute/done.js

function json(res, code, obj) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

const KV_URL = process.env.KV_REST_API_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || "";
function jobKey(id) { return `compute:job:${id}`; }

async function kv(pathParts, method = "GET", body) {
  if (!KV_URL || !KV_TOKEN) throw new Error("kv_not_configured");
  const url = `${KV_URL}/${pathParts.map(encodeURIComponent).join("/")}`;
  const headers = { Authorization: `Bearer ${KV_TOKEN}` };
  let opts = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(url, opts);
  const j = await r.json().catch(async () => ({ result: await r.text() }));
  if (!r.ok) throw new Error(`kv_${pathParts[0]}_failed`);
  return j;
}

async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY || "";
  if (!key || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Indianode <noreply@indianode.com>",
        to: [to],
        subject,
        html,
      }),
    });
  } catch {}
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
  const key = req.headers["x-provider-key"];
  if (!key || key !== process.env.COMPUTE_PROVIDER_KEY) {
    return json(res, 401, { error: "unauthorized" });
  }

  try {
    const { id, success, outputs, note } = req.body || {};
    if (!id) return json(res, 400, { error: "missing_id" });

    const got = await kv(["get", jobKey(id)]);
    const s = got?.result;
    if (!s) return json(res, 404, { error: "job_not_found" });
    const job = JSON.parse(s);

    job.status = success ? "completed" : "failed";
    job.completed_at = Date.now();
    if (outputs && typeof outputs === "object") {
      job.outputs = Object.assign({}, job.outputs || {}, outputs);
    }
    if (note) job.note = String(note);

    await kv(["set", jobKey(id), JSON.stringify(job)], "POST");

    // email the user (optional)
    if (job.email) {
      const subj = success
        ? `Indianode: job ${id} completed`
        : `Indianode: job ${id} failed`;
      const html = `<p>Job <b>${id}</b> finished with status <b>${job.status}</b>.</p>
<p>SKU: <b>${job.sku}</b> • Minutes: <b>${job.minutes}</b></p>
${job.outputs?.url ? `<p>Result URL: <a href="${job.outputs.url}">${job.outputs.url}</a></p>` : ""}
${note ? `<p>Note: ${note}</p>` : ""}`;
      await sendEmail({ to: job.email, subject: subj, html });
    }

    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { error: "server_error", message: e?.message || String(e) });
  }
}
