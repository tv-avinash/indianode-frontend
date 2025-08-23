// pages/api/gpu/run.sh.js
export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  // Cache disabled; this is tiny anyway
  res.setHeader("Cache-Control", "no-store");

  res.send(`#!/usr/bin/env bash
set -euo pipefail

echo "[*] Redeeming token with backend..."

if [ -z "\${ORDER_TOKEN:-}" ]; then
  echo "[!] ORDER_TOKEN env var is not set."
  echo
  echo "macOS/Linux:"
  echo "  export ORDER_TOKEN='v1...token...'"
  echo "  curl -fsSL https://www.indianode.com/api/gpu/run.sh | bash"
  echo
  echo "Windows (PowerShell):"
  echo "  \$env:ORDER_TOKEN = 'v1...token...'"
  echo "  (Invoke-WebRequest -UseBasicParsing https://www.indianode.com/api/gpu/run.sh).Content | bash"
  exit 1
fi

resp=\$(curl -sS -X POST 'https://www.indianode.com/api/gpu/redeem' \\
  -H 'Content-Type: application/json' \\
  --data-binary "{\\"token\\":\\"$\{ORDER_TOKEN\}\\"}" || true)

printf "%s" "\$resp"
echo

if echo "\$resp" | grep -q '"queued"'; then
  echo "[✓] Token accepted. Your GPU job has been queued."
else
  echo "[!] Unexpected response above."
fi
`);
}
