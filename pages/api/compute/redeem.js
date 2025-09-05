// pages/api/compute/redeem.js
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const body =
      typeof req.body === "object" && req.body
        ? req.body
        : (() => {
            try { return JSON.parse(req.body || "{}"); } catch { return {}; }
          })();

    const token = typeof body.token === "string" ? body.token : "";
    const sku = typeof body.sku === "string" ? body.sku : (body.product || "generic");
    const minutes = Number(body.minutes || body.qty || 60) || 60;
    const email = typeof body.email === "string" ? body.email : "";

    // SDL extras (optional)
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
