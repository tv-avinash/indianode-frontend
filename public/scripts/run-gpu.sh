#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-https://www.indianode.com}"
TOKEN="${ORDER_TOKEN:-}"

if [ -z "$TOKEN" ]; then
  echo "[!] ORDER_TOKEN env var is required."
  echo "Usage: curl -fsSL ${API_BASE}/scripts/run-gpu.sh | ORDER_TOKEN='v1.x.y.z' bash"
  exit 1
fi

echo "[*] Redeeming token against ${API_BASE} ..."
RESP="$(curl -sS -X POST "${API_BASE}/api/gpu/redeem" \
  -H 'Content-Type: application/json' \
  --data "{\"token\":\"${TOKEN}\"}")" || {
  echo "[!] Redeem request failed."
  exit 2
}

echo "$RESP" | jq . >/dev/null 2>&1 || true

if echo "$RESP" | grep -qi '"ok":\s*true'; then
  echo "[✓] Success:"
  echo "$RESP"
  exit 0
else
  echo "[!] Server responded with an error:"
  echo "$RESP"
  exit 3
fi
