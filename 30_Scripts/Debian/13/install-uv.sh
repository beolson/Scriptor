#!/usr/bin/env bash
set -euo pipefail

echo "[install-uv] Starting..."

echo "[install-uv] Downloading and running uv installer..."
wget -qO- https://astral.sh/uv/install.sh | sh

if [[ -n "${PRIVATE_CERTS_FILE:-}" ]]; then
  echo "[install-uv] PRIVATE_CERTS_FILE is set, configuring native TLS..."
  echo "export UV_NATIVE_TLS=true" | tee -a ~/.bashrc > /dev/null
  echo "export REQUESTS_CA_BUNDLE=$PRIVATE_CERTS_FILE" | tee -a ~/.bashrc > /dev/null
fi

echo "[install-uv] Done."
