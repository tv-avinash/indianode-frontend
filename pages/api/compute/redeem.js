export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const token = req.method === "POST" ? req.body?.token : req.query?.token;
  if (!token) return res.status(400).json({ error: "missing_token" });

  // TODO: verify token, enqueue your compute job, etc.
  return res.status(200).json({ ok: true, queued: true });
}
