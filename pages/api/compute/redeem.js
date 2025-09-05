// pages/api/compute/redeem.js
import { kv } from "@vercel/kv";

/**
 * Decode our v1 tokens of the form:
 *   v1.<base64url(JSON)>[.<sig>]
 * Returns {} on any failure.
 */
function decodeToken(t) {
  try {
    if (typeof t !== "string" || !t.startsWith("v1.")) return {};
    const parts = t.split(".");
    // payload is the 2nd segment (index 1). If it doesn’t exist, strip "v1." and try the rest.
    const b64url = parts[1] || t.slice(3);
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(b64, "base64").toString("utf8");
    const obj = JSON.parse(json);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    // Body may be object (from fetch) or string (from curl)
    const body =
      typeof req.body === "object" && req.body
        ? req.body
        : (() => {
            try { return JSON.parse(req.body || "{}"); } catch { return {}; }
          })();

    const token = typeof body.token === "string" ? body.token : "";
    const tok = decodeToken(token); // may contain { minutes, sku, email, ... }

    // Prefer explicit body fields; fall back to token; final fallback to defaults
    const sku =
      (typeof body.sku === "string" && body.sku) ||
      (typeof body.product === "string" && body.product) ||
      (typeof tok.sku === "string" && tok.sku) ||
      "generic";

    let minutesRaw =
      body.minutes ?? body.qty ?? tok.minutes ?? tok.qty ?? 60;
    let minutes = Number(minutesRaw);
    if (!Number.isFinite(minutes)) minutes = 60;
    minutes = Math.max(1, Math.floor(minutes)); // clamp to >= 1 whole minutes

    const email =
      (typeof body.email === "string" && body.email) ||
      (typeof tok.email === "string" && tok.email) ||
      "";

    // SDL extras (optional – only switches queue if present)
    const sdlRaw = typeof body.sdl === "string" ? body.sdl : "";
    const sdlB64 = typeof body.sdlB64 === "string" ? body.sdlB64 : "";
    const sdlName = typeof body.sdlName === "string" ? body.sdlName : "";
    const sdlNotes = typeof body.sdlNotes === "string" ? body.sdlNotes : "";

    let sdl = sdlRaw;
    if (!sdl && sdlB64) {
      try { sdl = Buffer.from(String(sdlB64), "base64").toString("utf8"); } catch {}
    }

    const now = Date.now();
    const id = `job_${Math.floor(now / 1000)}_${Math.random().toString(36).slice(2, 8)}`;

    const job = {
      id,
      status: "queued",
      sku,
      minutes,
      email,
      createdAt: now,
      message: "queued via redeem",
    };
    if (token) job.token = token;

    // Decide queue based on presence of SDL
    let queueKey = "compute:queue";
    if (sdl) {
      queueKey = "compute:queue:sdl";
      job.payload = { kind: "akash-sdl", sdl, sdlName, sdlNotes };
    }

    await kv.lpush(queueKey, JSON.stringify(job));

    return res.status(200).json({ ok: true, queued: true, id, queue: queueKey });
  } catch (err) {
    console.error("redeem error:", err);
    return res.status(500).json({ ok: false, error: "redeem_failed" });
  }
}
