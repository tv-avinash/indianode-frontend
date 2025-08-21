// pages/api/gpu/redeem.js
// Verifies ORDER_TOKEN (v1.<payload>.<sig>), blocks re-use, and (optionally) queues a job.
//
// Token payload example (base64url JSON):
// {
//   "v": 1,
//   "scope": "gpu",
//   "product": "sd" | "whisper" | "llama",
//   "minutes": 1..240,
//   "email": "user@example.com",
//   "ref": "pay_xxx",             // Razorpay payment id (or internal)
//   "iat": 1710000000,            // issued at (unix seconds)
//   "exp": 1710600000,            // expiry (unix seconds)
//   "jti": "random-unique-id"     // optional unique id
// }

import crypto from "crypto";

const SECRET = process.env.ORDER_TOKEN_SECRET || "";
const WEBHOOK = process.env.DEPLOYER_WEBHOOK || "";

// Optional persistence for one-time use
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const KV_URL = process.env.KV_REST_API_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || "";

// In-memory fallback (best-effort only on a single lambda instance)
const usedInMemory = new Set();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const { token } = (req.body || {});
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "missing_token" });
    }
    if (!SECRET) {
      return res.status(500).json({ error: "server_misconfigured", detail: "ORDER_TOKEN_SECRET not set" });
    }

    // --- Verify token (v1.<payload>.<sig>) ---
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "v1") {
      return res.status(400).json({ error: "bad_token_format" });
    }
    const payloadB64 = parts[1];
    const sig = parts[2];

    const expectedSig = hmacB64Url(SECRET, payloadB64);
    if (!timingSafeEqualB64(sig, expectedSig)) {
      return res.status(401).json({ error: "invalid_signature" });
    }

    let payload;
    try {
      payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    } catch {
      return res.status(400).json({ error: "bad_payload_json" });
    }

    // --- Validate claims ---
    const now = Math.floor(Date.now() / 1000);
    const {
      v, scope, product, minutes, email, ref, iat, exp, jti
    } = payload || {};

    if (v !== 1) return res.status(400).json({ error: "bad_version" });
    if (scope && scope !== "gpu") return res.status(400).json({ error: "bad_scope" });

    const PRODUCTS = new Set(["sd", "whisper", "llama"]);
    if (!PRODUCTS.has(String(product || ""))) {
      return res.status(400).json({ error: "bad_product" });
    }

    const mins = Number(minutes);
    if (!Number.isFinite(mins) || mins < 1 || mins > 240) {
      return res.status(400).json({ error: "bad_minutes" });
    }

    if (!isLikelyEmail(email)) {
      return res.status(400).json({ error: "bad_email" });
    }

    if (!ref || typeof ref !== "string") {
      return res.status(400).json({ error: "bad_ref" });
    }

    if (!Number.isFinite(iat) || !Number.isFinite(exp)) {
      return res.status(400).json({ error: "bad_time_claims" });
    }
    if (iat > now + 300) {
      return res.status(400).json({ error: "iat_in_future" });
    }
    if (exp <= now) {
      return res.status(400).json({ error: "token_expired" });
    }

    // --- Prevent double-spend (mark jti used) ---
    const ttl = Math.max(1, exp - now); // seconds
    const nonce = jti || sha1(payloadB64);

    const usedAlready = await markAlreadyUsed(nonce, ttl);
    if (usedAlready) {
      return res.status(409).json({ error: "token_already_used" });
    }

    // --- Queue job via webhook (optional) ---
    let queued = false;
    if (WEBHOOK) {
      try {
        const r = await fetch(WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "gpu_job",
            product,
            minutes: mins,
            email,
            ref,
            token,           // include full token if your worker re-validates
            meta: {
              source: "indianode-frontend",
              ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "",
              ua: req.headers["user-agent"] || "",
            },
          }),
        });
        if (!r.ok) throw new Error(`webhook_${r.status}`);
        queued = true;
      } catch (e) {
        // If queuing fails, free the token (so user can retry)
        await unmarkUsed(nonce);
        return res.status(502).json({ error: "queue_failed", detail: String(e.message || e) });
      }
    }

    return res.status(200).json({
      ok: true,
      queued,
      product,
      minutes: mins,
      email,
    });
  } catch (e) {
    console.error("redeem_error", e);
    return res.status(500).json({ error: "redeem_failed" });
  }
}

/* ---------------- helpers ---------------- */

function hmacB64Url(secret, data) {
  const h = crypto.createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(Buffer.from(data, "utf8"))
    .digest();
  return base64url(h);
}

function base64url(buf) {
  return Buffer.from(buf).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqualB64(a, b) {
  try {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

function sha1(s) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

function isLikelyEmail(s) {
  if (!s || typeof s !== "string") return false;
  // simple, permissive check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Try to mark a token id (nonce) as used with TTL.
 * Returns true if it was ALREADY used, false if we successfully marked it now.
 */
async function markAlreadyUsed(nonce, ttlSeconds) {
  // 1) Upstash Redis (SETNX + EX)
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const key = `order_token:${nonce}`;
      // SET key value NX EX <sec>
      const r = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}/${Date.now()}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        body: JSON.stringify({ nx: true, ex: ttlSeconds }),
      });
      const j = await r.json();
      // Upstash returns { result: "OK" } when it was set; null if exists
      if (j && j.result === null) return true;  // already used
      return false;
    } catch {}
  }

  // 2) Vercel KV
  if (KV_URL && KV_TOKEN) {
    try {
      const key = `order_token:${nonce}`;
      // SET key value NX EX seconds
      const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ value: Date.now(), nx: true, ex: ttlSeconds }),
      });
      const j = await r.json();
      // { result: true } if set, false if exists
      if (j && j.result === false) return true;
      return false;
    } catch {}
  }

  // 3) In-memory (best-effort)
  if (usedInMemory.has(nonce)) return true;
  usedInMemory.add(nonce);
  // schedule expiry
  setTimeout(() => usedInMemory.delete(nonce), ttlSeconds * 1000).unref?.();
  return false;
}

async function unmarkUsed(nonce) {
  // Upstash delete
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const key = `order_token:${nonce}`;
      await fetch(`${UPSTASH_URL}/del/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      });
      return;
    } catch {}
  }
  // Vercel KV delete
  if (KV_URL && KV_TOKEN) {
    try {
      const key = `order_token:${nonce}`;
      await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
      });
      return;
    } catch {}
  }
  // in-memory
  usedInMemory.delete(nonce);
}
