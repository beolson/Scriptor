#!/usr/bin/env bash
set -euo pipefail

EMAIL="${1}"

echo "[setup-ssh-keys] Starting..."

mkdir -p ~/.ssh
chmod 700 ~/.ssh

if [[ -f ~/.ssh/id_ed25519 ]]; then
  echo "[setup-ssh-keys] ~/.ssh/id_ed25519 already exists, skipping key generation."
else
  echo "[setup-ssh-keys] Generating Ed25519 SSH key for ${EMAIL}..."
  ssh-keygen -t ed25519 -C "${EMAIL}" -f ~/.ssh/id_ed25519 -N ""
fi

echo "[setup-ssh-keys] Public key:"
cat ~/.ssh/id_ed25519.pub

if command -v gh &> /dev/null && gh auth status &> /dev/null; then
  echo "[setup-ssh-keys] GitHub CLI is authenticated — uploading public key..."
  gh ssh-key add ~/.ssh/id_ed25519.pub --title "$(hostname)"
  echo "[setup-ssh-keys] Public key added to GitHub."
else
  echo "[setup-ssh-keys] GitHub CLI not available or not logged in — skipping GitHub upload."
fi

echo "[setup-ssh-keys] Done."
