// pages/api/compute/pick.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  // --- Auth (Bearer OR x-provider-key) ---
  const supplied =
    (req.headers.authorization || "").replace(/^bearer\s+/i, "") ||
    req.headers["x-provider-key"] ||
    "";
  const expected = process.env.COMPUTE_PROVIDER_KEY || "";
  if (!expected || supplied !== expected) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ ok: false, error: "kv_not_configured" });
  }

  // Helper to call Upstash REST
  async function kv(path, body) {
    const r = await fetch(`${KV_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { ok: r.ok, status: r.status, json: await r.json().catch(() => ({})) };
  }

  try {
    // Non-blocking pop; if empty, result === null
    const popped = await kv("/lpop/compute:queue");
    if (!popped.ok) {
      return res.status(502).json({ ok: false, error: "kv_lpop_failed", status: popped.status });
    }
    const raw = popped.json?.result || null;
    if (!raw) {
      return res.status(200).json({ ok: true, job: null });
    }

    // Parse the job payload that /redeem enqueued
    let job;
    try {
      job = JSON.parse(raw);
    } catch {
      return res.status(500).json({ ok: false, error: "queue_item_parse_failed" });
    }

    // Mark "running" right away so /status changes from "queued"
    const jobKey = `compute:job:${job.id}`;
    const now = Date.now();
    const running = {
      ...(job || {}),
      status: "running",
      startedAt: now,
      message: "picked by provider",
    };

    // Save with a TTL (e.g., 24h) so old records expire automatically
    const setRes = await kv(`/set/${encodeURIComponent(jobKey)}`, running);
    if (!setRes.ok) {
      return res.status(502).json({ ok: false, error: "kv_set_failed", status: setRes.status });
    }
    await kv(`/expire/${encodeURIComponent(jobKey)}/86400`);

    // Return the job to the worker
    return res.status(200).json({ ok: true, job: running });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", detail: String(e && e.message || e) });
  }
}
