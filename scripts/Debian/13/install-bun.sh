#!/usr/bin/env bash
set -euo pipefail

PRIVATE_CERTS_FILE="${PRIVATE_CERTS_FILE:-}"

echo "[install-bun] Starting..."

echo "[install-bun] Installing unzip (required by Bun installer)..."
sudo apt-get install -y unzip

echo "[install-bun] Installing Bun..."
if [[ -n "${PRIVATE_CERTS_FILE}" ]]; then
  CURL_CA_BUNDLE="${PRIVATE_CERTS_FILE}" curl -fsSL https://bun.sh/install | bash
else
  curl -fsSL https://bun.sh/install | bash
fi

if [[ -n "${PRIVATE_CERTS_FILE}" ]]; then
  echo "[install-bun] Configuring private certificate for Bun runtime..."
  echo "export NODE_EXTRA_CA_CERTS=${PRIVATE_CERTS_FILE}" | tee -a ~/.bashrc > /dev/null
fi

echo "[install-bun] Done. Run 'source ~/.bashrc' or start a new shell to apply changes."
