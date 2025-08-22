// pages/api/compute/pick.js

function json(res, code, obj) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

const KV_URL = process.env.KV_REST_API_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || "";
const QKEY = "compute:queue";
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

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
  const key = req.headers["x-provider-key"];
  if (!key || key !== process.env.COMPUTE_PROVIDER_KEY) {
    return json(res, 401, { error: "unauthorized" });
  }

  try {
    // RPOP = take from tail (FIFO with LPUSH)
    const pop = await kv(["rpop", QKEY], "POST");
    const id = pop?.result || null;
    if (!id) return json(res, 200, { ok: true, job: null });

    const got = await kv(["get", jobKey(id)]);
    const jobStr = got?.result;
    if (!jobStr) return json(res, 200, { ok: true, job: null });

    const job = JSON.parse(jobStr);
    job.status = "running";
    job.started_at = Date.now();
    await kv(["set", jobKey(id), JSON.stringify(job)], "POST");

    return json(res, 200, { ok: true, job });
  } catch (e) {
    return json(res, 500, { error: "server_error", message: e?.message || String(e) });
  }
}
