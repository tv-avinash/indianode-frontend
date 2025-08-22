// pages/api/compute/debug.js
export default async function handler(req, res) {
  const expected = process.env.COMPUTE_PROVIDER_KEY || "";
  const supplied =
    req.headers["x-provider-key"] ||
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

  res.status(200).json({
    ok: true,
    has_env: !!expected,
    env_len: expected.length,     // just lengths; no secrets exposed
    supplied_len: (supplied || "").length,
    equal: expected && supplied ? expected === supplied : false,
  });
}
