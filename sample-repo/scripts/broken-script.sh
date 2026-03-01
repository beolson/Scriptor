#!/usr/bin/env bash
set -euo pipefail

echo "[broken-script] Starting..."
sleep 0.2
echo "[broken-script] ERROR: Required dependency 'foobar' is not installed." >&2
echo "[broken-script] ERROR: Cannot continue without foobar >= 2.0" >&2
exit 1
