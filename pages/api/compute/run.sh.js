// Serves a plain-text bash script that redeems ORDER_TOKEN via /api/compute/redeem

export const config = {
  api: { bodyParser: false },
};

export const runtime = "nodejs";

export default function handler(req, res) {
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
  echo "[!] ORDER_TOKEN env var is not set."
  echo
  echo "macOS/Linux:"
  echo "  export ORDER_TOKEN='v1...token...'"
  echo "  curl -fsSL ${BASE}/api/compute/run.sh | bash"
  echo
  echo "Windows (PowerShell):"
  echo "  $env:ORDER_TOKEN = 'v1...token...'"
  echo "  (Invoke-WebRequest -UseBasicParsing '${BASE}/api/compute/run.sh').Content | bash"
  exit 1
fi

resp=$(curl -sS -X POST '${BASE}/api/compute/redeem' \
  -H 'Content-Type: application/json' \
  --data-binary "{\\"token\\":\\"\\\${ORDER_TOKEN}\\"}" || true)

printf "%s" "$resp"
echo

if echo "$resp" | grep -q '"queued"'; then
  echo "[✓] Token accepted. Your compute job has been queued."
else
  echo "[!] Unexpected response above."
fi
`;

  res.status(200).send(script);
}
