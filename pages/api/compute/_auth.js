// pages/api/compute/_auth.js
export function getProviderKeyFromReq(req) {
  const h = req.headers || {};
  const bearer = (h.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const x = (h["x-provider-key"] || "").toString().trim();
  return bearer || x;
}

export function checkAuth(req, res) {
  const serverKey = (process.env.COMPUTE_PROVIDER_KEY ||
                     process.env.PROVIDER_KEY || // fallback if you used old name
                     "").trim();

  const supplied = getProviderKeyFromReq(req);

  if (!serverKey || !supplied || supplied !== serverKey) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return false;
  }
  return true;
}
