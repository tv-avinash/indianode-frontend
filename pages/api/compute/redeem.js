// pages/api/compute/redeem.js
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    // Parse body safely
    const body =
      typeof req.body === "object" && req.body
        ? req.body
        : (() => {
            try {
              return JSON.parse(req.body || "{}");
            } catch {
              return {};
            }
          })();

    // Inputs from existing compute flow
    const token = typeof body.token === "string" ? body.token : "";
    const sku = typeof body.sku === "string" ? body.sku : (body.product || "generic");
    const minutes = Number(body.minutes || body.qty || 60) || 60;
    const email = typeof body.email === "string" ? body.email : "";

    // NEW: accept custom SDL (raw or base64) + optional metadata
    const sdlRaw = typeof body.sdl === "string" ? body.sdl : "";
    const sdlB64 = typeof body.sdlB64 === "string" ? body.sdlB64 : "";
    const sdlName = typeof body.sdlName === "string" ? body.sdlName : "";
    const sdlNotes = typeof body.sdlNotes === "string" ? body.sdlNotes : "";

    let sdl = sdlRaw;
    if (!sdl && sdlB64) {
      try {
        sdl = Buffer.from(String(sdlB64), "base64").toString("utf8");
      } catch {
        // ignore decode error; sdl stays empty
      }
    }

    // Generate a job id (same style)
    const now = Date.now();
    const id = `job_${Math.floor(now / 1000)}_${Math.random().toString(36).slice(2, 8)}`;

    // Build the job object; keep existing fields the same
    const job = {
      id,
      status: "queued",
      sku,
      minutes,
      email,
      createdAt: now,
      message: "queued via redeem",
    };

    // Preserve the token if you want the worker to see it (optional)
    if (token) job.token = token;

    // If SDL is provided, attach it as a payload – this does NOT affect other flows
    if (sdl) {
      job.payload = {
        kind: "akash-sdl",
        sdl,
        sdlName,
        sdlNotes,
      };
    }

    // Enqueue the job exactly like your existing flow
    // NOTE: If your code uses a different key, adjust "compute:queue" to match.
    await kv.lpush("compute:queue", JSON.stringify(job));

    // (Optional) store a side copy; safe to omit if your current flow doesn't need it
    // await kv.set(`compute:job:${id}`, JSON.stringify(job), { ex: 60 * 60 * 24 });

    return res.status(200).json({ ok: true, queued: true, id });
  } catch (err) {
    console.error("redeem error:", err);
    return res.status(500).json({ ok: false, error: "redeem_failed" });
  }
}
