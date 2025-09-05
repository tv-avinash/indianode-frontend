// pages/api/compute/pick-sdl.js
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    // Optional: gate with a provider key (same style as your existing /pick)
    const auth = req.headers.authorization || "";
    const okAuth = !!auth && auth.toLowerCase().startsWith("bearer ");
    if (!okAuth) {
      return res.status(401).json({ ok: false, error: "missing_bearer" });
    }

    // Pop one job from the SDL queue
    const raw = await kv.rpop("compute:queue:sdl");
    if (!raw) return res.status(200).json({ ok: true, job: null });

    let job = null;
    try {
      job = JSON.parse(raw);
    } catch {
      // skip bad json
    }

    return res.status(200).json({ ok: true, job });
  } catch (e) {
    console.error("pick-sdl error:", e);
    return res.status(500).json({ ok: false, error: "pick_sdl_failed" });
  }
}
