// pages/api/storage/pick.js
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method Not Allowed" });
    const auth = req.headers.authorization || "";
    if (!auth.toLowerCase().startsWith("bearer ")) {
      return res.status(401).json({ ok:false, error:"missing_bearer" });
    }
    const raw = await kv.rpop("compute:queue:storage");
    if (!raw) return res.status(200).json({ ok:true, job:null });
    let job = null;
    try { job = JSON.parse(raw); } catch {}
    return res.status(200).json({ ok:true, job });
  } catch (e) {
    console.error("storage/pick error:", e);
    return res.status(500).json({ ok:false, error:"pick_failed" });
  }
}
