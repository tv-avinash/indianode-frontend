// pages/api/storage/redeem.js
import crypto from "crypto";

const KV_URL = process.env.KV_URL;
const KV_TOKEN = process.env.KV_TOKEN;
const TOKEN_SECRET =
  process.env.STORAGE_ORDER_TOKEN_SECRET ||
  process.env.ORDER_TOKEN_SECRET ||
  process.env.GPU_ORDER_TOKEN_SECRET;

const STORAGE_SKUS = new Set(["nvme200", "nvme500", "nvme1tb"]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ ok: false, error: "kv_missing" });
  if (!TOKEN_SECRET) return res.status(500).json({ ok: false, error: "token_secret_missing" });

  try {
    const { token } = req.body || {};
    if (typeof token !== "string") return res.status(400).json({ ok: false, error: "bad_token_format" });
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "v1") return res.status(400).json({ ok: false, error: "bad_token_format" });
    const [, bodyB64, sig] = parts;

    let bodyJson;
    try { bodyJson = JSON.parse(Buffer.from(bodyB64, "base64url").toString("utf8")); }
    catch { return res.status(400).json({ ok: false, error: "bad_token_json" }); }

    const expectSig = crypto.createHmac("sha256", TOKEN_SECRET).update(bodyB64).digest("base64url");
    if (sig !== expectSig) return res.status(401).json({ ok: false, error: "bad_token_sig" });

    const now = Math.floor(Date.now() / 1000);
    const { v, kind, product, minutes, sizeGi, email = "", iat, exp } = bodyJson || {};
    if (v !== 1) return res.status(400).json({ ok: false, error: "bad_token_version" });
    if (typeof iat !== "number" || typeof exp !== "number" || now > exp)
      return res.status(400).json({ ok: false, error: "token_expired" });

    const prod = String(product || "").toLowerCase();
    if (!(kind === "storage" || STORAGE_SKUS.has(prod)))
      return res.status(400).json({ ok: false, error: "bad_token_kind" });

    const mins = Math.max(1, Math.min(480, Number(minutes || 60)));
    if (!STORAGE_SKUS.has(prod)) return res.status(400).json({ ok: false, error: "invalid_product" });

    const id = `job_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const job = {
      id,
      kind: "storage",
      product: prod,
      sizeGi: Number(sizeGi || (prod === "nvme200" ? 200 : prod === "nvme500" ? 500 : 1024)),
      minutes: mins,
      token,
      email: String(email || ""),
      enqueuedAt: Date.now(),
    };

    const authH = { Authorization: `Bearer ${KV_TOKEN}` };
    await fetch(`${KV_URL}/lpush/storage:queue/${encodeURIComponent(JSON.stringify(job))}`, {
      method: "POST", headers: authH,
    });

    const status = {
      ok: true, id, status: "queued", sku: prod, sizeGi: job.sizeGi, minutes: mins,
      email: job.email, createdAt: job.enqueuedAt, message: "queued via redeem",
    };
    await fetch(`${KV_URL}/set/storage:status:${id}/${encodeURIComponent(JSON.stringify(status))}`, {
      method: "POST", headers: authH,
    });

    return res.status(200).json({ ok: true, queued: true, id });
  } catch (e) {
    console.error("[storage/redeem]", e);
    return res.status(500).json({ ok: false, error: "redeem_exception", message: e.message });
  }
}
