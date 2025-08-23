// Serve a plain-text shell script so PowerShell treats it as text, not byte[]
export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const BASE = process.env.PUBLIC_BASE || 'https://www.indianode.com';

  const script = `#!/usr/bin/env bash
set -euo pipefail

echo "[*] Redeeming token with backend..."
if [ -z "\${ORDER_TOKEN:-}" ]; then
  echo "[!] ORDER_TOKEN not set"; exit 1
fi

# Call your existing redeem endpoint for compute
resp=$(curl -sS -X POST "${BASE}/api/compute/redeem" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"${ORDER_TOKEN}\"}" || true)

echo "$resp"

# Optional: basic sanity check
echo "$resp" | grep -q '"queued":true' && \
  echo "[✓] Token accepted. Your compute job has been queued." || \
  echo "[!] Unexpected response above."
`;

  res.status(200).send(script);
}
