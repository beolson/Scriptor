#!/usr/bin/env bash
set -e

DEST="/mnt/c/Users/beols/scriptor.exe"

echo "[build-win] Building Windows x64 binary..."
bun build tui/src/index.ts --compile --target bun-windows-x64 --outfile dist/scriptor-win.exe

echo "[build-win] Moving to $DEST..."
mv dist/scriptor-win.exe "$DEST"

echo "[build-win] Done."
