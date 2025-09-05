#!/usr/bin/env bash
# pages/api/storage/run.sh (served as text/plain by Next automatically)
# Usage:
#   export ORDER_TOKEN='v1.xxx.yyy'
#   curl -fsSL https://www.indianode.com/api/storage/run.sh | bash

set -euo pipefail

BASE="${BASE:-https://www.indianode.com}"

echo "[*] Redeeming token for S3 bucket..."
if [[ -z "${ORDER_TOKEN:-}" ]]; then
  echo "[!] ORDER_TOKEN not set"
  exit 1
fi

curl -fsS -X POST "$BASE/api/storage/redeem" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$ORDER_TOKEN\"}"

echo "[✓] Accepted. Your storage job is queued."
echo "[i] Worker will return endpoint + access keys when ready."
