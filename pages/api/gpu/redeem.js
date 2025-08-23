// pages/api/gpu/redeem.js
import crypto from "crypto";

const KV_URL   = process.env.KV_URL;
const KV_TOKEN = process.env.KV_TOKEN;
const TOKEN_SECRET = process.env.GPU_ORDER_TOKEN_SECRET || process.env.ORDER_TOKEN_SECRET;

const GPU_SKUS = new Set(["whisper", "sd", "llama"]); // accepted product keys

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ ok: false, error: "kv_missing" });
  }
  if (!TOKEN_SECRET) {
    return res.status(500).json({ ok: false, error: "token_secret_missing" });
  }

  try {
    const { token } = req.body || {};
    if (typeof token !== "string") {
      return res.status(400).json({ ok: false, error: "bad_token_format" });
    }

    // Expect v1.<payload>.<sig>
    if (!token.startsWith("v1.") || token.split(".").length !== 3) {
      return res.status(400).json({ ok: false, error: "bad_token_format" });
    }
    const [, bodyB64, sig] = token.split(".");
    let bodyJson;
    try {
      bodyJson = JSON.parse(Buffer.from(bodyB64, "base64url").toString("utf8"));
    } catch {
      return res.status(400).json({ ok: false, error: "bad_token_json" });
    }

    // Verify HMAC
    const expectSig = crypto
      .createHmac("sha256", TOKEN_SECRET)
      .update(bodyB64)
      .digest("base64url");
    if (sig !== expectSig) {
      return res.status(401).json({ ok: false, error: "bad_token_sig" });
    }

    // Validate claims
    const now = Math.floor(Date.now() / 1000);
    const {
      v,
      kind,              // "gpu" (new tokens). Old tokens may not have this.
      product,
      minutes,
      email = "",
      iat,
      exp
    } = bodyJson || {};

    if (v !== 1) return res.status(400).json({ ok: false, error: "bad_token_version" });
    if (typeof iat !== "number" || typeof exp !== "number" || now > exp) {
      return res.status(400).json({ ok: false, error: "token_expired" });
    }

    // Accept if kind is "gpu" OR (for backward-compat) product is in GPU set
    const prod = String(product || "").toLowerCase();
    if (!(kind === "gpu" || GPU_SKUS.has(prod))) {
      return res.status(400).json({ ok: false, error: "bad_token_kind" });
    }

    const mins = Math.max(1, Math.min(480, Number(minutes || 60)));
    if (!GPU_SKUS.has(prod)) {
      return res.status(400).json({ ok: false, error: "invalid_product" });
    }

    // Construct a job for the GPU queue
    const id = `job_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const job = {
      id,
      kind: "gpu",
      product: prod,
      minutes: mins,
      token,         // keep whole token for audit if needed
      email: String(email || ""),
      enqueuedAt: Date.now()
    };

    // Push to Upstash (use path style to avoid JSON body parsing issues)
    const authH = { Authorization: `Bearer ${KV_TOKEN}` };

    // lpush gpu:queue <job-json>
    await fetch(
      `${KV_URL}/lpush/gpu:queue/${encodeURIComponent(JSON.stringify(job))}`,
      { method: "POST", headers: authH }
    );

    // Set status key
    const status = {
      ok: true,
      id,
      status: "queued",
      sku: prod,
      minutes: mins,
      email: job.email,
      createdAt: job.enqueuedAt,
      message: "queued via redeem"
    };
    await fetch(
      `${KV_URL}/set/gpu:status:${id}/${encodeURIComponent(JSON.stringify(status))}`,
      { method: "POST", headers: authH }
    );

    return res.status(200).json({ ok: true, queued: true, id });
  } catch (e) {
    console.error("[gpu/redeem]", e);
    return res.status(500).json({ ok: false, error: "redeem_exception", message: e.message });
  }
}
