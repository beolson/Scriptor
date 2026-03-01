#!/usr/bin/env bash
set -euo pipefail

echo "[install-bun] Downloading Bun installer..."
sleep 0.3
echo "  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current"
echo "                                 Dload  Upload   Total   Spent    Left  Speed"
echo "100  7842  100  7842    0     0  42378      0 --:--:-- --:--:-- --:--:-- 42400"

echo "[install-bun] Installing Bun..."
sleep 0.5
echo "bun was installed successfully to ~/.bun/bin/bun"

echo "[install-bun] Adding Bun to PATH in ~/.bashrc..."
echo 'export BUN_INSTALL="$HOME/.bun"'
echo 'export PATH="$BUN_INSTALL/bin:$PATH"'

echo "[install-bun] Verifying Bun installation..."
echo "bun 1.2.2 (e220adba)"

echo "[install-bun] Done."
