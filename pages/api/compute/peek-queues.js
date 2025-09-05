// pages/api/compute/peek-queues.js
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  if (!auth || !auth.toLowerCase().startsWith("bearer "))
    return res.status(401).json({ ok:false, error:"missing_bearer" });

  async function info(key) {
    const len = Number(await kv.llen(key) || 0);
    const headRaw = len > 0 ? await kv.lindex(key, 0)  : null;   // newest (LPUSH)
    const tailRaw = len > 0 ? await kv.lindex(key, -1) : null;   // next to be RPOP'ed
    let head=null, tail=null;
    try { head = headRaw ? JSON.parse(headRaw) : null; } catch {}
    try { tail = tailRaw ? JSON.parse(tailRaw) : null; } catch {}
    return { len, head, tail };
  }

  const sdl = await info("compute:queue:sdl");
  const def = await info("compute:queue");
  return res.status(200).json({ ok:true, sdl, def });
}
