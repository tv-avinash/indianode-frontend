// pages/api/compute/complete.js
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const secret = process.env.COMPUTE_WORKER_SECRET || "";
  const auth = req.headers.authorization || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const { id, status = "done", message = "" } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: "missing_id" });

  await kv.hset(`compute:job:${id}`, { status, endedAt: Date.now(), message });
  await kv.lpush(
    "compute:done",
    JSON.stringify({ id, status, at: Date.now(), message })
  );

  return res.json({ ok: true });
}
