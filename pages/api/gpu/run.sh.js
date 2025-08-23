// pages/api/gpu/run.sh.js
// Serves a bash script that reads ORDER_TOKEN and calls /api/gpu/redeem

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  // Build absolute origin for any domain/preview
  const host =
    req.headers["x-forwarded-host"] || req.headers.host || "www.indianode.com";
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const origin = `${proto}://${host}`;

  // NOTE: we escape ${...} as \${...} so JS doesn't interpolate it
  const script = `#!/usr/bin/env bash
set -euo pipefail

echo "[*] Redeeming token with backend..."

if [ -z "\\\${ORDER_TOKEN:-}" ]; then
  echo "[!] ORDER_TOKEN env var is not set."
  echo
  echo "macOS/Linux:"
  echo "  export ORDER_TOKEN='v1.…token…'"
  echo "  curl -fsSL ${origin}/api/gpu/run.sh | bash"
  echo
  echo "Windows (PowerShell):"
  echo "  $env:ORDER_TOKEN = 'v1.…token…'"
  echo "  (Invoke-WebRequest -UseBasicParsing '${origin}/api/gpu/run.sh').Content | bash"
  exit 1
fi

resp=$(curl -sS -X POST '${origin}/api/gpu/redeem' \\
  -H 'Content-Type: application/json' \\
  --data-binary "{\\"token\\":\\"\\\${ORDER_TOKEN}\\"}" || true)

printf "%s" "$resp"
echo

# Friendly line if backend already returns JSON only:
if echo "$resp" | grep -q '"queued"'; then
  echo "[✓] Token accepted. Your GPU job has been queued."
else
  echo "[!] Unexpected response above."
fi
`;

  res.setHeader("Content-Type", "text/x-shellscript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(200).send(script);
}
