#!/usr/bin/env bash
set -euo pipefail

echo "[*] Preparing /data..."
mkdir -p /data && cd /data

echo "[*] Installing minimal tools (Debian/Ubuntu base images assumed)..."
apt-get update -y
apt-get install -y python3-pip git aria2 ca-certificates
rm -rf /var/lib/apt/lists/*

pip3 install -q --no-cache-dir huggingface_hub==0.23.5

echo "[*] Examples — uncomment the ones you want."

: <<'EXAMPLES'
# Example 1: Llama-2 7B (GGUF) — requires acceptance of Meta license on HF (use your own token if needed)
python3 - <<'PY'
from huggingface_hub import snapshot_download
snapshot_download(repo_id="TheBloke/Llama-2-7B-Chat-GGUF",
                  local_dir="/data/llama2",
                  local_dir_use_symlinks=False,
                  max_workers=4)
print("Llama-2 GGUF downloaded to /data/llama2")
PY

# Example 2: Mistral-7B Instruct
python3 - <<'PY'
from huggingface_hub import snapshot_download
snapshot_download(repo_id="mistralai/Mistral-7B-Instruct-v0.2",
                  local_dir="/data/mistral7b",
                  local_dir_use_symlinks=False,
                  max_workers=4)
print("Mistral-7B Instruct downloaded to /data/mistral7b")
PY

# Example 3: Generic HTTP/HTTPS dataset
# aria2c -x8 -s8 -k1M -d /data/datasets -o file.zip "https://example.com/dataset.zip" && #   unzip -q /data/datasets/file.zip -d /data/datasets && rm /data/datasets/file.zip
EXAMPLES

echo "[*] Done. Check /data for your files."
