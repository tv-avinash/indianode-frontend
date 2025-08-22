// Serves a shell script that redeems an ORDER_TOKEN on your backend
export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method Not Allowed");
  }

  const BASE =
    process.env.NEXT_PUBLIC_DEPLOYER_BASE ||
    process.env.DEPLOYER_BASE ||
    "";

  // Build the script (always plain text)
  const script = `#!/usr/bin/env bash
set -euo pipefail

# --- sanity ---
if [ -z "\${ORDER_TOKEN:-}" ]; then
  echo "[!] ORDER_TOKEN env var is required. Example:"
  echo "    export ORDER_TOKEN='v1.xxxxxx'"
  echo "    curl -fsSL ${BASE || "https://YOUR-BACKEND"} /api/compute/run.sh | bash"
  exit 1
fi

BACKEND_BASE="${BASE}"

if [ -z "$BACKEND_BASE" ]; then
  echo "[!] Server missing DEPLOYER_BASE. Ask the provider to set NEXT_PUBLIC_DEPLOYER_BASE."
  exit 1
fi

echo "[*] Redeeming token with backend..."
# Adjust this path to whatever your backend expects:
# e.g. POST ${BASE}/compute/redeem with JSON { token: ORDER_TOKEN }
curl -fsS -X POST \\
  -H 'Content-Type: application/json' \\
  -d '{"token":"'\${ORDER_TOKEN}'"}' \\
  "$BACKEND_BASE/compute/redeem"

echo "[✓] Token accepted. Your compute job has been queued."
`;

  res.setHeader("Content-Type", "text/x-sh; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(script);
}
