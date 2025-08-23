// Serve a plain-text shell script that redeems ORDER_TOKEN via /api/compute/redeem

export const config = {
  api: {
    bodyParser: false, // ensure we just stream text out
  },
  // If you previously forced edge runtime somewhere, keep this on node:
  // runtime: "nodejs",
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  const BASE = process.env.PUBLIC_BASE || "https://www.indianode.com";

  const script = `#!/usr/bin/env bash
set -euo pipefail

echo "[*] Redeeming token with backend..."
if [ -z "\${ORDER_TOKEN:-}" ]; then
  echo '{"ok":false,"error":"missing_order_token"}'
  exit 1
fi

resp=$(curl -sS -X POST "${BASE}/api/compute/redeem" \
  -H "Content-Type: application/json" \
  --data "{\"token\":\"${ORDER_TOKEN}\"}" || true)

echo "$resp"

if echo "$resp" | grep -q '"queued":true'; then
  echo "[✓] Token accepted. Your compute job has been queued."
else
  echo "[!] Unexpected response above."
fi
`;

  res.status(200).send(script);
}
