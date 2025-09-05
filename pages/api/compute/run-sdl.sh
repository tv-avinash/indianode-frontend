// pages/api/compute/run-sdl.sh
// Returns a bash script (text) – identical pattern to your compute/run.sh helper
export default function handler(_req, res) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  const BASE =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    "https://www.indianode.com";

  // NOTE: forwards MINUTES into /redeem so your queue doesn't default to 60
  const body = `#!/usr/bin/env bash
set -euo pipefail

BASE="\${BASE:-${BASE}}"

if [[ -z "\${ORDER_TOKEN:-}" ]]; then
  echo "[!] ORDER_TOKEN not set" >&2
  exit 1
fi

# SDL can be provided via SDL_B64 (preferred) or plain SDL
if [[ -z "\${SDL_B64:-}" && -z "\${SDL:-}" ]]; then
  echo "[!] Provide SDL_B64 (preferred) or SDL" >&2
  exit 1
fi

# Build JSON safely
if [[ -n "\${SDL_B64:-}" ]]; then
  SDL_FIELD="\\\\\\\"sdlB64\\\\\\\":\\\\\\\"\${SDL_B64}\\\\\\\""
else
  # escape JSON quotes for plain SDL
  esc=$(printf %s "\${SDL}" | sed 's/"/\\\\\\"/g')
  SDL_FIELD="\\\\\\\"sdl\\\\\\\":\\\\\\\"\${esc}\\\\\\\""
fi

MINUTES_FIELD=""
if [[ -n "\${MINUTES:-}" ]]; then
  MINUTES_FIELD=",\\\\\\\"minutes\\\\\\\":\${MINUTES}"
fi

NOTES_FIELD=""
if [[ -n "\${SDL_NOTES:-}" ]]; then
  escn=$(printf %s "\${SDL_NOTES}" | sed 's/"/\\\\\\"/g')
  NOTES_FIELD=",\\\\\\\"sdlNotes\\\\\\\":\\\\\\\"\${escn}\\\\\\\""
fi
if [[ -n "\${SDL_NAME:-}" ]]; then
  escm=$(printf %s "\${SDL_NAME}" | sed 's/"/\\\\\\"/g')
  NOTES_FIELD="\${NOTES_FIELD},\\\\\\\"sdlName\\\\\\\":\\\\\\\"\${escm}\\\\\\\""
fi

payload="{\\\\\\\"token\\\\\\\":\\\\\\\"\${ORDER_TOKEN}\\\\\\\", \${SDL_FIELD}\${MINUTES_FIELD}\${NOTES_FIELD}}"

echo "[*] Redeeming token for custom SDL..."
resp=$(curl -sS -X POST "\${BASE}/api/compute/redeem" \\
  -H 'content-type: application/json' \\
  -d "\${payload}" || true)
echo "\${resp}"

if echo "\${resp}" | grep -q '"ok":true'; then
  echo "[✓] Accepted. Your custom-SDL job is queued."
  echo "[i] Worker will receive payload.kind='akash-sdl' and your SDL in payload.sdl."
else
  echo "[!] Failed to redeem token."
  exit 1
fi
`;
  res.send(body);
}
