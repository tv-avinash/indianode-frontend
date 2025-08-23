// pages/api/compute/run.sh
export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  res.setHeader("Content-Type", "text/x-shellscript; charset=utf-8");
  res.status(200).send(`#!/usr/bin/env bash
set -euo pipefail

if [ -z "\${ORDER_TOKEN:-}" ]; then
  echo "[!] ORDER_TOKEN env var is not set."
  echo "    macOS/Linux: export ORDER_TOKEN='v1.xxxxxx'"
  echo "    Windows PS:  $env:ORDER_TOKEN = 'v1.xxxxxx'"
  exit 1
fi

echo "[*] Redeeming token with backend..."
curl -fsS -X POST "${process.env.NEXT_PUBLIC_DEPLOYER_BASE || process.env.VERCEL_URL ? 'https://www.indianode.com' : ''}/api/compute/redeem" \\
  -H "Content-Type: application/json" \\
  -d "{\\"token\\": \\"\${ORDER_TOKEN}\\"}"

echo "[?] Token accepted. Your compute job has been queued."
`);
}
