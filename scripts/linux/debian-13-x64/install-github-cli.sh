#!/usr/bin/env bash
# ---
# platform: debian-13-x64
# title: Install GitHub CLI
# description: Installs the GitHub CLI (gh) from the official GitHub apt repository.
# group: debian-13-dev-box
# group_order: 1
# ---
# Installs the [GitHub CLI](https://cli.github.com/) (`gh`) on Debian 13 (x64)
# using the official GitHub-hosted apt repository.
#
# ## What it does
#
# 1. Installs `git` and `curl` if not already present.
# 2. Adds the GitHub CLI GPG key and apt source (skips if already configured).
# 3. Installs `gh`.
#
# ## Requirements
#
# - Debian 13 (x64), running natively (not in WSL)
# - Regular user with `sudo` access
# - Internet connection

set -euo pipefail
trap 'echo "Script failed on line $LINENO" >&2' ERR

# ── Skip if already installed ─────────────────────────────────────────────────

if command -v gh &>/dev/null; then
	echo "GitHub CLI is already installed: $(gh --version | head -1)"
	exit 0
fi

# ── Prerequisites ─────────────────────────────────────────────────────────────

packages_to_install=()
command -v git  &>/dev/null || packages_to_install+=(git)
command -v curl &>/dev/null || packages_to_install+=(curl)

if [[ ${#packages_to_install[@]} -gt 0 ]]; then
	echo "Installing missing packages: ${packages_to_install[*]}..."
	sudo apt-get update -y
	sudo apt-get install -y "${packages_to_install[@]}"
fi

# ── GitHub CLI apt repository ─────────────────────────────────────────────────

echo "Adding GitHub CLI apt repository..."

sudo mkdir -p -m 755 /etc/apt/keyrings

tmp_gpg=$(mktemp)
curl -fsSL -o "$tmp_gpg" https://cli.github.com/packages/githubcli-archive-keyring.gpg
sudo install -o root -g root -m 644 "$tmp_gpg" /etc/apt/keyrings/githubcli-archive-keyring.gpg
rm -f "$tmp_gpg"

if [[ ! -f /etc/apt/sources.list.d/github-cli.list ]]; then
	echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
		| sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
fi

# ── Install ───────────────────────────────────────────────────────────────────

echo "Installing GitHub CLI..."
sudo apt-get update -y
sudo apt-get install -y gh

echo "GitHub CLI installed: $(gh --version | head -1)"
