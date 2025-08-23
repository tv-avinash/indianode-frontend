// pages/api/compute/redeem.js
export const config = { api: { bodyParser: true }, runtime: "nodejs" };

const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const RESEND   = process.env.RESEND_API_KEY || "";
const SECRET   = process.env.COMPUTE_ORDER_TOKEN_SECRET || process.env.ORDER_TOKEN_SECRET || "";

async function kvSet(key, value) {
  if (!KV_URL || !KV_TOKEN) return;
  await fetch(`${KV_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
}

async function kvRPush(key, value) {
  if (!KV_URL || !KV_TOKEN) return;
  await fetch(`${KV_URL}/rpush/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
}

// Robust base64url -> utf8
function b64urlToUtf8(b64u) {
  try {
    const clean = String(b64u).replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (clean.length % 4)) % 4);
    return Buffer.from(clean + pad, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function parseToken(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;

    const [ver, payloadB64, sig] = parts;
    if (ver !== "v1" || !payloadB64) return null;

    const json = b64urlToUtf8(payloadB64);
    if (!json) return null;
    const data = JSON.parse(json);

    // If we have a secret and a non-placeholder signature, verify HMAC
    if (SECRET && sig && sig !== "sig") {
      const crypto = require("crypto");
      const expected = crypto.createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
      if (expected !== sig) {
        // Signature invalid – return a marker so the caller can decide what to do
        return { __invalidSig: true, ...data };
      }
    }
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
  } catch {}
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const token = String(req.body?.token || process.env.ORDER_TOKEN || "").trim();
  if (!token) return res.status(400).json({ ok: false, error: "missing_token" });

  const data = parseToken(token);
  if (!data) return res.status(400).json({ ok: false, error: "bad_token" });
  if (data.__invalidSig) {
    // You can change this to reject if you want strict verification.
    // For now we accept for backwards-compat with placeholder ".sig" tokens.
    // return res.status(400).json({ ok: false, error: "invalid_signature" });
  }

  // Accept both "sku" and "product" fields; default to generic.
  const sku = String(data.sku || data.product || "generic");
  const minutes = Math.max(1, Number(data.minutes || 1));
  const email = String(data.email || "");

  const id = `job_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const job = {
    id,
    kind: "compute",
    sku,
    minutes,
    token,
    email,
    enqueuedAt: Date.now(),
  };

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
      createdAt: job.enqueuedAt,
      message: "queued via redeem",
    })
  );

  await sendEmail(
    email,
    "Job queued",
    `<p>Your job <b>${id}</b> is queued for ${minutes} min on <b>${sku}</b>.</p>`
  ).catch(() => {});

  return res.status(200).json({ ok: true, queued: true, id });
}
