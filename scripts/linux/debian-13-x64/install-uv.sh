#!/usr/bin/env bash
# ---
# platform: debian-13-x64
# title: Install uv (Python Package Manager)
# description: Installs uv, the fast Python package and project manager from Astral.
# group: debian-13-dev-box
# group_order: 5
# ---
# Installs [uv](https://docs.astral.sh/uv/) — a fast Python package manager and
# project tool — using the official Astral install script.
#
# ## What it does
#
# - Installs `curl` if not present
# - Downloads and runs the official uv installer via curl
# - Installs uv to `~/.local/bin/uv` (no sudo required)
# - Skips installation if uv is already present
#
# ## Requirements
#
# - Regular user with `sudo` access (only needed if `curl` is missing)
# - Internet connection

set -euo pipefail
trap 'echo "Script failed on line $LINENO" >&2' ERR

ensure_curl() {
	if command -v curl &>/dev/null; then
		return
	fi
	echo "Installing curl..."
	sudo -v
	sudo apt-get update -y
	sudo apt-get install -y curl
}

install_uv() {
	if command -v uv &>/dev/null || [[ -x "$HOME/.local/bin/uv" ]]; then
		echo "uv is already installed, skipping"
		return
	fi
	echo "Installing uv..."
	curl -LsSf https://astral.sh/uv/install.sh | sh
}

ensure_curl
install_uv

echo "uv installed successfully."
echo "Run 'source ~/.bashrc' or open a new shell to use uv."
