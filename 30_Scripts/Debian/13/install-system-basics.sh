#!/usr/bin/env bash
set -euo pipefail

echo "[install-system-basics] Starting..."

echo "[install-system-basics] Updating package lists..."
sudo apt-get update -y

echo "[install-system-basics] Upgrading installed packages..."
sudo apt-get upgrade -y

echo "[install-system-basics] Installing curl, wget, and libicu-dev..."
sudo apt-get install -y curl wget libicu-dev

echo "[install-system-basics] Done."
