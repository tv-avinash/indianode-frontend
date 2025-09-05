// pages/api/compute/run-sdl.sh.js
// Serves a bash script that reads ORDER_TOKEN and SDL_B64 and calls your redeem endpoint.
// Matches the same "pipe curl | bash" pattern used by your Compute page.

export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  // If you have a PUBLIC_BASE env, we use it; else fall back to current host.
  const BASE = process.env.PUBLIC_BASE || "";

  const script = `#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE}"
if [ -z "$BASE" ]; then
  # Try to reconstruct base from the request's Host header (best effort)
  BASE="$(printf "https://%s" "${req.headers["x-forwarded-host"] || req.headers.host || "www.indianode.com"}")"
fi

echo "[*] Redeeming token for custom SDL..."
if [ -z "\${ORDER_TOKEN:-}" ]; then
  echo "[!] ORDER_TOKEN not set"; exit 1
fi
if [ -z "\${SDL_B64:-}" ]; then
  echo "[!] SDL_B64 not set (base64 of your SDL YAML)"; exit 1
fi

# POST to your existing redeem endpoint with { token, sdlB64 }
resp=$(curl -fsS "$BASE/api/compute/redeem" \
  -H "Content-Type: application/json" \
  --data-binary "$(printf '{"token":"%s","sdlB64":"%s"}' "$ORDER_TOKEN" "$SDL_B64")" || true)

echo "$resp"

if echo "$resp" | grep -q '"queued":true'; then
  echo "[✓] Accepted. Your custom-SDL job is queued."
  echo "[i] Worker will receive payload.kind='akash-sdl' and your SDL in payload.sdl."
else
  echo "[!] Unexpected response above."
fi
`;
  res.status(200).send(script);
}
