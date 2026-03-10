#!/usr/bin/env bash
set -euo pipefail

echo "[install-git-gh] Starting..."

echo "[install-git-gh] Installing git..."
sudo apt-get install -y git

echo "[install-git-gh] Adding GitHub CLI apt repository..."
sudo mkdir -p -m 755 /etc/apt/keyrings
out=$(mktemp)
wget -nv -O "$out" https://cli.github.com/packages/githubcli-archive-keyring.gpg
cat "$out" | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null
rm -f "$out"
sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null

echo "[install-git-gh] Installing gh..."
sudo apt-get update
sudo apt-get install -y gh

echo "[install-git-gh] Done."
