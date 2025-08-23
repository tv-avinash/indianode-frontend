// pages/api/compute/run.sh.js
export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  // Always serve pure text so PowerShell treats it as a string, not bytes/HTML
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  const BASE = process.env.PUBLIC_BASE || "https://www.indianode.com";

  const script = `#!/usr/bin/env bash
set -euo pipefail

echo "[*] Redeeming token with backend..."
if [ -z "\${ORDER_TOKEN:-}" ]; then
  echo "[!] ORDER_TOKEN not set"; exit 1
fi

# POST JSON safely (no jq required)
resp=$(curl -sS -X POST "${BASE}/api/compute/redeem" \
  -H "Content-Type: application/json" \
  --data-binary "$(printf '{"token":"%s"}' "$ORDER_TOKEN")" || true)

echo "$resp"

# Basic success check
if echo "$resp" | grep -q '"queued":true'; then
  echo "[✓] Token accepted. Your compute job has been queued."
else
  echo "[!] Unexpected response above."
fi
`;
  res.status(200).send(script);
}
