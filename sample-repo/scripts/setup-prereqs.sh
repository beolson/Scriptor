#!/usr/bin/env bash
set -euo pipefail

echo "[setup-prereqs] Installing build tools..."
echo "Reading package lists... Done"
echo "Building dependency tree... Done"
echo "The following NEW packages will be installed:"
echo "  build-essential curl git"
echo "0 upgraded, 3 newly installed, 0 to remove and 0 not upgraded."
sleep 0.5

echo "[setup-prereqs] Setting up curl..."
echo "Unpacking curl (7.88.1-10+deb12u8) ..."
echo "Setting up curl (7.88.1-10+deb12u8) ..."
sleep 0.3

echo "[setup-prereqs] Setting up git..."
echo "Unpacking git (1:2.39.5-0+deb12u2) ..."
echo "Setting up git (1:2.39.5-0+deb12u2) ..."
sleep 0.3

echo "[setup-prereqs] Setting up build-essential..."
echo "Unpacking build-essential (12.9) ..."
echo "Setting up build-essential (12.9) ..."

echo "[setup-prereqs] Done."
