#!/usr/bin/env bash
set -e
ARCH=$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
URL="https://github.com/beolson/Scriptor/releases/latest/download/scriptor-${OS}-${ARCH}"
sudo curl -fsSL "$URL" -o /usr/local/bin/scriptor
sudo chmod +x /usr/local/bin/scriptor
scriptor
