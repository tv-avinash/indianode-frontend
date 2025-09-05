// pages/api/compute/pick-sdl.js
import { kv } from "@vercel/kv";
import crypto from "crypto";

const h8 = (s) =>
  s ? crypto.createHash("sha1").update(String(s)).digest("hex").slice(0, 8) : "";

function toJob(raw) {
  // Handle both legacy object items and JSON-string items
  if (raw == null) return null;

  // If the KV SDK gave us an object directly, use it as-is
  if (typeof raw === "object") return raw;

  // If it’s a string, try to parse JSON
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      // Some bad items may be stringified "[object Object]"; ignore parse error
      return null;
    }
  }
  return null;
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

    const kvfp = {
      vercel_env: process.env.VERCEL_ENV || "",
      runtime: process.env.NEXT_RUNTIME || "nodejs",
      url_hash: h8(process.env.KV_REST_API_URL),
      token_hash: h8(process.env.KV_REST_API_TOKEN),
      nsid_hash: h8(process.env.KV_REST_NAMESPACE_ID),
    };

    const key = "compute:queue:sdl";
    const lenBefore = Number((await kv.llen(key)) || 0);
    if (lenBefore <= 0) {
      return res.status(200).json({ ok: true, job: null, lenBefore, kvfp });
    }

    const raw = await kv.rpop(key);
    const lenAfter = Number((await kv.llen(key)) || 0);

    const job = toJob(raw);
    if (job && typeof job === "object") {
      return res
        .status(200)
        .json({ ok: true, job, lenBefore, lenAfter, kvfp });
    }

    // Couldn’t parse into a job; return debug so you can inspect the raw value
    return res.status(200).json({
      ok: true,
      job: null,
      lenBefore,
      lenAfter,
      kvfp,
      note: "popped item was not parseable; see job_raw_string",
      job_raw_string: String(raw),
      job_raw_type: typeof raw,
    });
  } catch (e) {
    console.error("pick-sdl error:", e);
    return res.status(500).json({ ok: false, error: "pick_sdl_failed" });
  }
}
