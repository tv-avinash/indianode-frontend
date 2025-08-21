export default function handler(req, res) {
  const proto = (req.headers["x-forwarded-proto"] || "https");
  const host = req.headers.host || "localhost:3000";
  const base = `${proto}://${host}`;

  res.setHeader("Content-Type", "text/x-shellscript; charset=utf-8");
  res.status(200).send(`#!/usr/bin/env bash
set -euo pipefail

if [[ -z "\${ORDER_TOKEN:-}" ]]; then
  echo "[!] ORDER_TOKEN env is required" >&2
  exit 2
fi

echo "[*] Redeeming ORDER_TOKEN with ${base} …"
resp=$(curl -fsSL -X POST '${base}/api/gpu/redeem' \
  -H 'Content-Type: application/json' \
  --data "{\"token\":\"${ORDER_TOKEN}\"}")

echo "$resp"
echo "[ok] Submitted. You'll receive your deploy URL by email when queued."
`);
}
