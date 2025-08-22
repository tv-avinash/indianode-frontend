// pages/api/compute/next.js
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

  // Pop oldest job (make sure redeem/enqueue does RPUSH)
  const raw = await kv.lpop("compute:queue");
  if (!raw) return res.json({ ok: true, empty: true });

  let job;
  try {
    job = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return res.json({ ok: true, empty: true });
  }

  job.startedAt = Date.now();
  await kv.hset(`compute:job:${job.id}`, job);

  return res.json({ ok: true, job });
}
