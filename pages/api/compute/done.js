// pages/api/compute/done.js
const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvGet(key) {
  try {
    const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      cache: "no-store",
    });
    const text = await r.text();
    try {
      const j = JSON.parse(text);
      if (j && typeof j === "object" && "result" in j) {
        return j.result ? JSON.parse(j.result) : null;
      }
      return j;
    } catch {
      return text ? JSON.parse(text) : null;
    }
  } catch {
    return null;
  }
}

async function kvSet(key, value) {
  await fetch(`${KV_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  }).catch(() => {});
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const { id, success = false, message = "" } =
      (typeof req.body === "object" && req.body) ? req.body : {};
    if (!id) return res.status(400).json({ ok: false, error: "missing_id" });

    const key = `compute:status:${id}`;
    const prev = await kvGet(key);
    const now  = Date.now();

    const status = success ? "done" : "failed";

    const next = {
      ...(prev || {}),
      OK: true,
      id,
      status,                 // "done" | "failed"
      message,
      finishedAt: now,
      updatedAt: now,
    };

    await kvSet(key, JSON.stringify(next));

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "done_exception", detail: String(e) });
  }
}
