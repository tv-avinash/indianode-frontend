// pages/api/compute/redeem.js
import { kv } from "@vercel/kv";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  // Expect: { token, product, minutes, email }
  const { token, product, minutes, email } = req.body || {};

  // TODO: validate token signature/expiry/payment here.
  if (!token) return res.status(400).json({ ok: false, error: "missing_token" });

  const id = `job_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  const job = {
    id,
    kind: "compute",
    product: (product || "generic").toString(),
    minutes: Number(minutes || 60),
    token: token.toString(),
    email: (email || "").trim(),
    enqueuedAt: Date.now(),
  };

  // Queue tail -> pop head (FIFO)
  await kv.rpush("compute:queue", JSON.stringify(job));
  return res.json({ ok: true, queued: true, id });
}
