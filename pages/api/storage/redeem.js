// pages/api/storage/redeem.js
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method Not Allowed" });

    const body = typeof req.body === "object" ? req.body : (()=>{ try { return JSON.parse(req.body||"{}"); } catch { return {}; }})();
    const token = String(body.token || "");
    const email = String(body.email || "");
    const jobNotes = String(body.notes || "");

    if (!token) return res.status(400).json({ ok:false, error:"missing_token" });

    const now = Date.now();
    const id = `job_${Math.floor(now/1000)}_${Math.random().toString(36).slice(2,8)}`;
    const job = {
      id,
      status: "queued",
      sku: "storage",
      email,
      createdAt: now,
      message: "queued via storage/redeem",
      token,
      payload: { kind: "storage-minio", notes: jobNotes },
    };

    await kv.lpush("compute:queue:storage", JSON.stringify(job));
    return res.status(200).json({ ok:true, queued:true, id, queue:"compute:queue:storage" });
  } catch (e) {
    console.error("storage/redeem error:", e);
    return res.status(500).json({ ok:false, error:"redeem_failed" });
  }
}
