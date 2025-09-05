// pages/api/compute/peek-queues.js
import { kv } from "@vercel/kv";
import crypto from "crypto";

const h8 = s => (s ? crypto.createHash("sha1").update(String(s)).digest("hex").slice(0,8) : "");

export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ ok:false, error:"missing_bearer" });
  }

  const kvfp = {
    vercel_env: process.env.VERCEL_ENV || "",
    runtime: process.env.NEXT_RUNTIME || "nodejs",
    url_hash:  h8(process.env.KV_REST_API_URL),
    token_hash:h8(process.env.KV_REST_API_TOKEN),
    nsid_hash: h8(process.env.KV_REST_NAMESPACE_ID),
  };

  async function info(key) {
    const len = Number(await kv.llen(key) || 0);
    // show last 3 (tail side) without popping
    const tailRaw = len ? await kv.lrange(key, Math.max(0, len-3), len-1) : [];
    const tail = tailRaw.map(s => { try { return JSON.parse(s); } catch { return String(s); } });
    return { len, tail };
  }

  const sdl = await info("compute:queue:sdl");
  const def = await info("compute:queue");

  return res.status(200).json({ ok:true, kvfp, sdl, def });
}
