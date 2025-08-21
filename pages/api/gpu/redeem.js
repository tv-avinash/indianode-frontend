// pages/api/gpu/redeem.js
import crypto from "crypto";

export const config = { api: { bodyParser: true } };

function fromB64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return Buffer.from(s + "=".repeat(pad), "base64").toString("utf8");
}
function verifyTokenV1(secret, token) {
  // token format: v1.<header>.<payload>.<sig>
  const parts = String(token || "").split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("bad_format");
  const [ , encHeader, encPayload, sig ] = parts;

  const expectSig = crypto
    .createHmac("sha256", secret)
    .update(`${encHeader}.${encPayload}`)
    .digest();
  const gotSig = Buffer.from(
    sig.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (sig.length % 4)) % 4),
    "base64"
  );
  if (!crypto.timingSafeEqual(expectSig, gotSig)) throw new Error("bad_signature");

  const header = JSON.parse(fromB64url(encHeader));
  const payload = JSON.parse(fromB64url(encPayload));
  if (header?.v !== 1 || header?.alg !== "HS256") throw new Error("bad_header");
  const now = Math.floor(Date.now() / 1000);
  if (payload?.exp && now > payload.exp) throw new Error("expired");
  return payload;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const { token } = req.body || {};
  if (!token) {
    res.status(400).json({ error: "missing_token" });
    return;
  }

  const TOKEN_SECRET = process.env.TOKEN_SECRET;
  const DEPLOYER_BASE =
    process.env.DEPLOYER_BASE || process.env.NEXT_PUBLIC_DEPLOYER_BASE;
  const PROVIDER_API_KEY = process.env.PROVIDER_API_KEY;

  if (!TOKEN_SECRET) {
    res.status(500).json({ error: "missing_env_TOKEN_SECRET" });
    return;
  }
  if (!DEPLOYER_BASE) {
    res.status(500).json({ error: "missing_env_DEPLOYER_BASE" });
    return;
  }
  if (!PROVIDER_API_KEY) {
    res.status(500).json({ error: "missing_env_PROVIDER_API_KEY" });
    return;
  }

  let payload;
  try {
    payload = verifyTokenV1(TOKEN_SECRET, token);
  } catch (e) {
    res.status(401).json({ error: "invalid_token", detail: e.message });
    return;
  }

  // Call your deployer/agent
  try {
    const r = await fetch(`${DEPLOYER_BASE.replace(/\/+$/g, "")}/api/gpu/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PROVIDER_API_KEY}`,
      },
      body: JSON.stringify({
        token, // forward as-is (agent can log/validate again)
        product: payload.product,
        minutes: payload.minutes,
        email: payload.email,
        meta: { source: "site", promo: payload.promo || null },
      }),
    });

    const j = await r.json().catch(() => ({}));

    if (r.status === 409) {
      res.status(409).json({
        error: "gpu_busy",
        message:
          j?.message ||
          "GPU is busy; your job is queued. You’ll receive email when it starts.",
      });
      return;
    }

    if (!r.ok) {
      res
        .status(502)
        .json({ error: "agent_error", message: j?.error || "start_failed" });
      return;
    }

    res.status(200).json({
      ok: true,
      message:
        j?.message ||
        "Deployment started (or queued). We’ll email you the URL shortly.",
      url: j?.url || null,
      queueId: j?.queueId || null,
    });
  } catch (e) {
    res.status(500).json({ error: "agent_unreachable", detail: String(e) });
  }
}
