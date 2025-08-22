// pages/api/compute/mint.js
import crypto from "crypto";

function json(res, code, obj) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

// ---- token helpers ----
const TOKEN_SECRET =
  process.env.ORDER_TOKEN_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "dev_secret_replace_me";

function b64urlEncode(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}
function b64urlDecode(str) {
  return JSON.parse(Buffer.from(String(str), "base64url").toString("utf8"));
}

function sign(payload) {
  const body = b64urlEncode(payload);
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
  return `v1.${body}.${sig}`;
}
function verify(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("bad_token_format");
  const body = parts[1];
  const sig = parts[2];
  const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
  if (sig !== expected) throw new Error("bad_token_sig");
  const payload = b64urlDecode(body);
  if (payload.exp && Date.now() / 1000 > Number(payload.exp)) throw new Error("token_expired");
  return payload;
}

// ---- Upstash KV (REST) helpers ----
const KV_URL = process.env.KV_REST_API_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || "";
async function kvCmd(pathParts, method = "GET", body) {
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

// queue helpers (simple Redis list + per-job JSON string)
const QKEY = "compute:queue";
function jobKey(id) { return `compute:job:${id}`; }

async function pushJob(job) {
  // store job JSON as plain string
  await kvCmd(["set", jobKey(job.id), JSON.stringify(job)], "POST");
  await kvCmd(["lpush", QKEY, job.id], "POST");
}

async function getJob(id) {
  const r = await kvCmd(["get", jobKey(id)]);
  const s = r?.result;
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

async function setJob(id, job) {
  await kvCmd(["set", jobKey(id), JSON.stringify(job)], "POST");
}

// ---- Razorpay helpers (optional) ----
function hasRzpKeys() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}
async function verifyPayment(paymentId) {
  if (!hasRzpKeys()) return { ok: true, mode: "test" };

  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString("base64");

  const r = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!r.ok) return { ok: false, error: "rzp_fetch_failed" };
  const p = await r.json();

  if (p?.status !== "captured") {
    return { ok: false, error: "payment_not_captured", details: p?.status };
  }
  return { ok: true, payment: p };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });

  try {
    const body = req.body || {};

    // ----- Redeem flow -----
    if (body.redeem && body.token) {
      let payload;
      try { payload = verify(body.token); }
      catch (e) { return json(res, 400, { error: e.message || "bad_token" }); }

      if (payload.kind !== "compute") {
        return json(res, 400, { error: "wrong_token_kind" });
      }

      const id = `job_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
      const now = Date.now();
      const job = {
        id,
        kind: "compute",
        sku: payload.product || "generic",
        minutes: Math.max(1, Number(payload.minutes || 1)),
        email: payload.email || "",
        pay_id: payload.pay_id || "",
        queued_at: now,
        status: "queued",
        progress: 0,
        outputs: {},
      };

      await pushJob(job);

      // optional email
      if (process.env.RESEND_API_KEY && job.email) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: process.env.RESEND_FROM || "Indianode <noreply@indianode.com>",
              to: [job.email],
              subject: "Indianode: compute job queued",
              html: `<p>Your job <b>${id}</b> is queued.</p><p>SKU: <b>${job.sku}</b> • Minutes: <b>${job.minutes}</b></p>`,
            }),
          });
        } catch {}
      }

      return json(res, 200, { ok: true, queued: true, id });
    }

    // ----- Mint flow -----
    const { paymentId, product, minutes, email, promo } = body;
    if (!paymentId || !product) return json(res, 400, { error: "bad_request" });

    const ver = await verifyPayment(paymentId);
    if (!ver.ok) return json(res, 400, { error: "payment_verify_failed", details: ver.error });

    const nowSec = Math.floor(Date.now() / 1000);
    const payload = {
      v: 1,
      kind: "compute",
      product,
      minutes: Math.max(1, Number(minutes || 1)),
      email: (email || "").trim(),
      pay_id: paymentId,
      iat: nowSec,
      exp: nowSec + 7 * 24 * 3600, // token valid 7 days
      promo: String(promo || "").trim(),
    };

    const token = sign(payload);
    return json(res, 200, { token });
  } catch (e) {
    return json(res, 500, { error: "server_error", message: e?.message || String(e) });
  }
}
