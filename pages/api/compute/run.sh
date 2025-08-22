# pages/api/compute/run.sh
# NOTE: This is served as text/plain shell script by Next.js
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

cat <<'BANNER'
[*] Redeeming token with backend...
BANNER

read_stdin() {
  # read STDIN into variable if piped
  if [ -p /dev/stdin ]; then
    cat -
  else
    cat /dev/null
  fi
}

# Prefer environment variable ORDER_TOKEN; fall back to first arg
TOKEN="${ORDER_TOKEN:-$1}"

if [ -z "$TOKEN" ]; then
  echo "[!] ORDER_TOKEN not set."
  echo "    Linux/macOS:"
  echo "      export ORDER_TOKEN='v1.xxxxxx'"
  echo "      curl -fsSL https://www.indianode.com/api/compute/run.sh | bash"
  echo "    Windows PowerShell:"
  echo "      setx ORDER_TOKEN \"v1.xxxxxx\""
  echo "      curl.exe -fsSL https://www.indianode.com/api/compute/run.sh | bash"
  exit 1
fi

REDEEM_URL="https://www.indianode.com/api/compute/mint"

JSON_PAYLOAD=$(printf '{"redeem":true,"token":"%s"}' "$TOKEN")

HTTP_RES=$(curl -sS -X POST "$REDEEM_URL" \
  -H "Content-Type: application/json" \
  --data "$JSON_PAYLOAD")

echo "$HTTP_RES"

OK=$(echo "$HTTP_RES" | grep -o '"ok":true')
if [ -n "$OK" ]; then
  echo "[✓] Token accepted. Your compute job has been queued."
  exit 0
else
  echo "[x] Could not queue job."
  exit 1
fi
