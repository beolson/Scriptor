#!/usr/bin/env bash
set -euo pipefail

PRIVATE_CERTS_FILE="${1:-}"

echo "[install-az-azd] Starting..."

echo "[install-az-azd] Installing Azure CLI..."
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

echo "[install-az-azd] Installing Azure Developer CLI..."
curl -fsSL https://aka.ms/install-azd.sh | bash

if [[ -n "${PRIVATE_CERTS_FILE}" ]]; then
  echo "[install-az-azd] Configuring private certificate..."
  echo "export AZURE_CLI_DISABLE_CONNECTION_VERIFICATION=1" | tee -a ~/.bashrc > /dev/null
  echo "export REQUESTS_CA_BUNDLE=${PRIVATE_CERTS_FILE}" | tee -a ~/.bashrc > /dev/null
fi

echo "[install-az-azd] Done. Run 'source ~/.bashrc' or start a new shell to apply changes."
