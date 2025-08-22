// pages/api/compute/progress.js
import { kv } from "@vercel/kv";

async function sendEmail(to, subject, text) {
  const API = process.env.RESEND_API_KEY;
  const FROM = process.env.RESEND_FROM;
  if (!API || !FROM || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, text })
    });
  } catch {}
}

function auth(req) {
  const h = req.headers["authorization"] || req.headers["Authorization"] || "";
  const x = req.headers["x-provider-key"] || req.headers["X-Provider-Key"] || "";
  const key = h.startsWith("Bearer ") ? h.slice(7) : (x || "");
  return key && key === process.env.PROVIDER_KEY;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
    if (!auth(req)) return res.status(401).json({ ok: false, error: "unauthorized" });

    const { id, status = "running", message = "" } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: "missing_id" });

    const PFX  = process.env.KV_PREFIX || "compute";
    const SKEY = `${PFX}:status:${id}`;

    const current = await kv.get(SKEY);
    let obj = {};
    try { obj = current ? JSON.parse(current) : {}; } catch {}

    const updated = {
      ...obj,
      id,
      status,
      message: message || obj.message || "",
      updatedAt: Date.now()
    };
    await kv.set(SKEY, JSON.stringify(updated), { ex: 7 * 24 * 3600 });

    // Optional “picked” email only once
    if (status === "running" && obj.status !== "running" && (obj.email || "").includes("@")) {
      await sendEmail(obj.email, "Your compute job has started", `Job ${id} is now running.`);
    }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
