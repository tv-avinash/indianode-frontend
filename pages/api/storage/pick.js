// pages/api/storage/pick.js
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const auth = req.headers.authorization || "";
    if (!auth.toLowerCase().startsWith("bearer ")) {
      return res.status(401).json({ ok: false, error: "missing_bearer" });
    }

    const lenBefore = await kv.llen("compute:queue:storage").catch(() => null);
    const raw = await kv.rpop("compute:queue:storage");

    let job = null;
    if (raw) {
      try { job = JSON.parse(raw); } catch {}
    }

    const lenAfter = await kv.llen("compute:queue:storage").catch(() => null);

    return res.status(200).json({
      ok: true,
      job,
      lenBefore,
      lenAfter,
      kvfp: {
        vercel_env: process.env.VERCEL_ENV || process.env.NODE_ENV || "",
        runtime: "nodejs",
      },
    });
  } catch (e) {
    console.error("pick-storage error:", e);
    return res.status(500).json({ ok: false, error: "pick_storage_failed" });
  }
}
