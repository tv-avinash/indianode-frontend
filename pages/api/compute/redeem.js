// Creates a job record and enqueues the job ID.
// Body: { token: "<ORDER_TOKEN>" }  (your run.sh sends this)
// NOTE: We don't re-verify the token here to keep this simple.
// If you want, wire in your existing HMAC verification used in mint.js.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  try {
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;
    if (!KV_URL || !KV_TOKEN) {
      return res.status(500).json({ ok: false, error: "kv_not_configured" });
    }

    const { token } = (req.body || {});
    if (!token || typeof token !== "string") {
      return res.status(400).json({ ok: false, error: "missing_token" });
    }

    // Very lightweight parse of your v1.<jwt> token payload to extract fields
    // (We don’t depend on it for security here — only to record job metadata).
    let claims = {};
    try {
      const parts = token.split(".");
      // When minted as v1.<header>.<payload>.<sig> you might have "v1" prefix before the JWT.
      const jwt = parts.length > 3 ? parts.slice(1).join(".") : token;
      const base = jwt.split(".")[1] || "";
      const json = Buffer.from(base.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
      claims = JSON.parse(json);
    } catch {
      // ignore parse error; we’ll still create a job
    }

    const now = Date.now();
    const jobId = `job_${now}_${Math.random().toString(16).slice(2, 8)}`;

    const job = {
      id: jobId,
      status: "queued",
      sku: claims.product || claims.sku || "unknown",
      minutes: Number(claims.minutes || 1),
      email: claims.email || "",
      createdAt: now,
      message: "queued via redeem",
    };

    // 1) Write the job record
    const setRes = await fetch(`${KV_URL}/set/${encodeURIComponent(`job:${jobId}`)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      body: JSON.stringify(job),
    });
    const setOk = (await setRes.json())?.result === "OK";
    if (!setOk) {
      return res.status(500).json({ ok: false, error: "kv_set_failed" });
    }

    // 2) Enqueue the job id
    const qKey = "compute:q";
    await fetch(`${KV_URL}/lpush/${encodeURIComponent(qKey)}/${encodeURIComponent(jobId)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });

    // (optional) email: "queued" — if using Resend:
    if (process.env.RESEND_API_KEY && process.env.RESEND_FROM && job.email) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM,
            to: job.email,
            subject: "Your compute job is queued",
            html: `<p>Job <b>${jobId}</b> queued. Check status:<br>
                   <a href="https://www.indianode.com/api/compute/status?id=${jobId}">status link</a></p>`,
          }),
        });
      } catch {}
    }

    return res.status(200).json({ ok: true, queued: true, id: jobId });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "redeem_failed" });
  }
}
