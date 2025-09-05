// pages/api/storage/pick.js
// Pops a single job from the storage queue.
// Requires: Authorization: Bearer <PROVIDER_KEY>

import { getKV } from "../../lib/kv";             // adjust relative paths to your project layout
import { kvFingerprint } from "../../lib/kv";     // optional (for diagnostics)
import { verifyProviderKey } from "../../lib/auth";

const QUEUE_KEY = "compute:queue:storage";        // must match run.sh enqueuer

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const auth = verifyProviderKey(req.headers.authorization || "");
  if (!auth.ok) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const kv = getKV();

  // length before
  const lenBefore = (await kv.lLen(QUEUE_KEY)) || 0;

  // pop one (adjust to lPop/rPop depending on how you push)
  const raw = await kv.rPop(QUEUE_KEY);

  const lenAfter = (await kv.lLen(QUEUE_KEY)) || 0;

  let job = null;
  if (raw) {
    try {
      job = JSON.parse(raw);
    } catch {
      job = { raw };
    }
  }

  return res.status(200).json({
    ok: true,
    job: job || null,
    lenBefore,
    lenAfter,
    kvfp: typeof kvFingerprint === "function" ? kvFingerprint() : undefined,
  });
}
