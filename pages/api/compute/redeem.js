// pages/api/compute/redeem.js
const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const RESEND   = process.env.RESEND_API_KEY || "";

async function kvReq(path, body = null) {
  const url = `${KV_URL}${path}`;
  const init = {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  };
  if (body != null) {
    init.body = typeof body === "string" ? body : String(body);
  }
  const r = await fetch(url, init);
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`KV ${path} failed ${r.status}: ${t}`);
  }
}

async function kvSet(key, value) {
  return kvReq(`/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`);
}
async function kvRPush(key, value) {
  return kvReq(`/rpush/${encodeURIComponent(key)}/${encodeURIComponent(value)}`);
}

function fromBase64Url(b64url) {
  try {
    let s = String(b64url || "");
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return Buffer.from(s, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function parseToken(tok) {
  try {
    const parts = String(tok || "").split(".");
    if (parts.length < 2) return null;            // must have v1.<payload>[.<sig>]
    const header = parts[0];
    if (!/^v1$/.test(header)) return null;        // only v1 supported
    const payloadJson = fromBase64Url(parts[1]);
    if (!payloadJson) return null;
    const data = JSON.parse(payloadJson);
    return data;
  } catch {
    return null;
  }
}

async function sendEmail(to, subject, html) {
  if (!RESEND || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND}`,
      },
      body: JSON.stringify({
        from: "Indianode <notify@mail.indianode.com>",
        to,
        subject,
        html,
      }),
    });
  } catch {
    /* ignore */
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ ok: false, error: "kv_missing" });
  }

  const token =
    (req.body && (req.body.token || req.body.ORDER_TOKEN)) ||
    req.headers["x-order-token"] ||
    process.env.ORDER_TOKEN ||
    "";

  const tok = String(token || "").trim();
  if (!tok) return res.status(400).json({ ok: false, error: "missing_token" });

  const data = parseToken(tok);
  // Must look like a compute token
  if (!data || (data.kind && data.kind !== "compute")) {
    return res.status(400).json({ ok: false, error: "bad_token" });
  }

  const sku =
    String(data.sku || data.product || "generic").toLowerCase().trim() || "generic";
  const minutes = Math.max(1, Number(data.minutes || 1));
  const email = (data.email || "").trim();

  const id = `job_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const now = Date.now();
  const job = {
    id,
    kind: "compute",
    sku,
    minutes,
    token: tok,
    email,
    enqueuedAt: now,
  };

  // enqueue and set status record
  await kvRPush("compute:queue", JSON.stringify(job));
  await kvSet(
    `compute:status:${id}`,
    JSON.stringify({
      ok: true,
      id,
      status: "queued",
      sku,
      minutes,
      email,
      createdAt: now,
      message: "queued via redeem",
    })
  );

  // notify user if email present
  await sendEmail(
    email,
    "Compute job queued",
    `<p>Your job <b>${id}</b> is queued for <b>${minutes} min</b> on <b>${sku}</b>.</p>`
  );

  return res.status(200).json({ ok: true, queued: true, id });
}
