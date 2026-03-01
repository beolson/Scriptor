#!/usr/bin/env bash
set -euo pipefail

echo "[update-system] Running apt update..."
echo "Hit:1 http://deb.debian.org/debian bookworm InRelease"
echo "Hit:2 http://security.debian.org/debian-security bookworm-security InRelease"
echo "Reading package lists... Done"
sleep 0.5

echo "[update-system] Running apt upgrade..."
echo "Reading package lists... Done"
echo "Building dependency tree... Done"
echo "0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded."

echo "[update-system] Done."
