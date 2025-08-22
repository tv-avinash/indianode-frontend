#!/usr/bin/env bash
# compute/run.sh — Redeem ORDER_TOKEN for a CPU job
set -euo pipefail

if [[ "${ORDER_TOKEN:-}" == "" ]]; then
  echo "ERROR: ORDER_TOKEN env var not set." >&2
  echo "Usage: curl -fsSL https://your-backend.example/compute/run.sh | ORDER_TOKEN='v1.xxx' bash" >&2
  exit 2
fi

# Where your API lives (defaults to your main site)
API_BASE="${API_BASE:-https://www.indianode.com}"
# Your redeem endpoint for CPU workloads (adjust if you named it differently)
REDEEM="${REDEEM_ENDPOINT:-/api/compute/redeem}"

UA="indianode-cli/1 compute.run.sh"
tmp="$(mktemp)"

# POST the token; capture HTTP code and body
code=$(curl -sS -w '%{http_code}' -o "$tmp" \
  -X POST "$API_BASE$REDEEM" \
  -H 'content-type: application/json' \
  -H "user-agent: $UA" \
  -d "{\"orderToken\":\"$ORDER_TOKEN\"}")

if [[ "$code" != "200" ]]; then
  echo "Redeem failed ($code)." >&2
  cat "$tmp" >&2 || true
  rm -f "$tmp"
  exit 1
fi

resp="$(cat "$tmp")"
rm -f "$tmp"

# Best-effort JSON field extraction without jq
jobId=$(printf '%s' "$resp" | sed -n 's/.*"jobId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
mins=$(printf '%s' "$resp" | sed -n 's/.*"minutes"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -n1)
product=$(printf '%s' "$resp" | sed -n 's/.*"product"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
url=$(printf '%s' "$resp" | sed -n 's/.*"statusUrl"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)

echo "✅ Redeemed ORDER_TOKEN."
[[ -n "$product" ]] && echo "Product : $product"
[[ -n "$mins" ]] && echo "Duration: ${mins} min"
[[ -n "$jobId" ]] && echo "Job ID  : $jobId"
[[ -n "$url" ]] && echo "Watch   : $url"

# Nothing else happens on the client; your backend enforces runtime & limits.
exit 0
