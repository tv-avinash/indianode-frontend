// pages/api/compute/run.sh.js
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://www.indianode.com";
  const script = `#!/usr/bin/env bash
set -euo pipefail
if [ -z "\${ORDER_TOKEN:-}" ]; then
  echo "[!] Please set ORDER_TOKEN first, then run:"
  echo "    ORDER_TOKEN='<your token>' bash -lc \\"curl -fsSL ${base}/api/compute/run.sh | bash\\""
  exit 1
fi
echo "[*] Redeeming token with backend..."
curl -sS -X POST '${base}/api/compute/redeem' \\
  -H 'Content-Type: application/json' \\
  -d '{ "token": "'"\${ORDER_TOKEN}"'" }'
echo
echo "[?] Token accepted. Your compute job has been queued."
`;
  res.setHeader("Content-Type", "text/x-shellscript; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.status(200).send(script);
}
