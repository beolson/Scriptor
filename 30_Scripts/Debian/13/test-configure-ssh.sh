#!/usr/bin/env bash
set -euo pipefail

echo "[test-configure-ssh] Starting..."

echo "[test-configure-ssh] Verifying sudo credential caching..."
sudo whoami
sudo id

echo "[test-configure-ssh] Done."
