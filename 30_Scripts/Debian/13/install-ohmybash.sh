#!/usr/bin/env bash
set -euo pipefail

echo "[install-ohmybash] Starting..."

echo "[install-ohmybash] Downloading and running Oh My Bash installer..."
wget -qO- https://raw.githubusercontent.com/ohmybash/oh-my-bash/master/tools/install.sh | bash

echo "[install-ohmybash] Setting theme to agnoster..."
sed -i 's/^OSH_THEME.*/OSH_THEME="agnoster"/' ~/.bashrc

echo "[install-ohmybash] Done."
