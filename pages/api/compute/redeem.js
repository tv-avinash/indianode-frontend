// pages/api/compute/redeem.js
import crypto from "crypto";

const KV_URL   = process.env.KV_REST_API_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || "";
const RESEND   = process.env.RESEND_API_KEY || "";
const ORDER_SECRET = process.env.ORDER_TOKEN_SECRET || ""; // used for HMAC verify

const ALLOWED_SKUS = new Set(["cpu2x4","cpu4x8","cpu8x16","redis","nginx","generic"]);

async function kvSet(key, value) {
  if (!KV_URL || !KV_TOKEN) throw new Error("kv_missing");
  await fetch(`${KV_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
}
async function kvRPush(key, value) {
  if (!KV_URL || !KV_TOKEN) throw new Error("kv_missing");
  await fetch(`${KV_URL}/rpush/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
}

function decodeBodyPart(t) {
  try {
    const parts = String(t).split(".");
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json);
  } catch { return null; }
}

function verifyToken(t) {
  // Accept legacy tokens ending with ".sig" (no HMAC), but prefer to verify when possible.
  const parts = String(t).split(".");
  if (parts.length !== 3) {
    // legacy?
    const d = decodeBodyPart(t);
    return { data: d, verified: false };
  }
  const [, body, sig] = parts;
  if (!ORDER_SECRET) return { data: decodeBodyPart(t), verified: false };

  const expected = crypto.createHmac("sha256", ORDER_SECRET).update(body).digest("base64url");
  const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) return { data: null, verified: false };
  try {
    const d = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return { data: d, verified: true };
  } catch {
    return { data: null, verified: false };
  }
}

async function sendEmail(to, subject, html) {
  if (!RESEND || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND}` },
      body: JSON.stringify({ from: "Indianode <notify@mail.indianode.com>", to, subject, html }),
    });
  } catch {}
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok:false, error:"method_not_allowed" });
  }

  try {
    const token = String(req.body?.token || process.env.ORDER_TOKEN || "").trim();
    if (!token) return res.status(400).json({ ok:false, error:"missing_token" });

    const { data } = verifyToken(token);
    if (!data) return res.status(400).json({ ok:false, error:"bad_token" });

    if (data.kind !== "compute") {
      return res.status(400).json({ ok:false, error:"wrong_kind" });
    }

    const sku = String(data.sku || data.product || "generic").toLowerCase();
    if (!ALLOWED_SKUS.has(sku)) return res.status(400).json({ ok:false, error:"invalid_sku" });

    const mins = Math.max(1, Math.min(480, Number(data.minutes || 1)));
    const id = `job_${Date.now()}_${Math.random().toString(16).slice(2,8)}`;

    const job = {
      id,
      kind: "compute",
      sku,
      minutes: mins,
      token,
      email: String(data.email || ""),
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
        minutes: mins,
        email: job.email,
        createdAt: job.enqueuedAt,
        message: "queued via redeem",
      })
    );

    await sendEmail(
      job.email,
      "Job queued",
      `<p>Your job <b>${id}</b> is queued for ${mins} min on ${sku}.</p>`
    ).catch(()=>{});

    return res.status(200).json({ ok:true, queued:true, id });
  } catch (e) {
    const msg = e?.message || String(e);
    if (msg === "kv_missing") {
      return res.status(500).json({ ok:false, error:"kv_missing" });
    }
    console.error(e);
    return res.status(500).json({ ok:false, error:"redeem_exception", detail: msg });
  }
}
