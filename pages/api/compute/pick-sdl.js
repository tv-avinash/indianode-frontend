// pages/api/compute/pick-sdl.js
import { kv } from "@vercel/kv";
import crypto from "crypto";

function hash8(s) {
  if (!s) return "";
  return crypto.createHash("sha1").update(String(s)).digest("hex").slice(0, 8);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const auth = req.headers.authorization || "";
    if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
      return res.status(401).json({ ok: false, error: "missing_bearer" });
    }

    // show which KV this route sees
    const kvfp = {
      vercel_env: process.env.VERCEL_ENV || "",
      runtime: process.env.NEXT_RUNTIME || "nodejs",
      url_hash: hash8(process.env.KV_REST_API_URL),
      token_hash: hash8(process.env.KV_REST_API_TOKEN),
      nsid_hash: hash8(process.env.KV_REST_NAMESPACE_ID),
    };

    const key = "compute:queue:sdl";
    const lenBefore = Number((await kv.llen(key)) || 0);

    if (lenBefore <= 0) {
      return res.status(200).json({ ok: true, job: null, lenBefore, kvfp });
    }

    const raw = await kv.rpop(key);
    const lenAfter = Number((await kv.llen(key)) || 0);

    try {
      const job = JSON.parse(raw);
      return res.status(200).json({ ok: true, job, lenBefore, lenAfter, kvfp });
    } catch {
      // fallback if item is not JSON (shouldn't happen, but helpful to see)
      return res.status(200).json({
        ok: true,
        job_raw: String(raw),
        lenBefore,
        lenAfter,
        kvfp,
      });
    }
  } catch (e) {
    console.error("pick-sdl error:", e);
    return res.status(500).json({ ok: false, error: "pick_sdl_failed" });
  }
}
