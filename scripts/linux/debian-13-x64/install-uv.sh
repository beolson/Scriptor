#!/usr/bin/env bash
# ---
# platform: debian-13-x64
# title: Install uv (Python Package Manager)
# description: Installs uv, the fast Python package and project manager from Astral.
# ---
# Installs [uv](https://docs.astral.sh/uv/) — a fast Python package manager and
# project tool — using the official Astral install script.
#
# ## What it does
#
# - Downloads and runs the official uv installer via curl
# - Installs uv to `~/.local/bin/uv` (no sudo required)
# - Skips installation if uv is already present
#
# ## Requirements
#
# - `curl` must be installed (`sudo apt-get install -y curl`)

set -euo pipefail
trap 'echo "Script failed on line $LINENO" >&2' ERR

check_prerequisites() {
	if ! command -v curl &>/dev/null; then
		echo "Error: curl is required but not installed. Run: sudo apt-get install -y curl" >&2
		exit 1
	fi
}

install_uv() {
	if command -v uv &>/dev/null || [[ -x "$HOME/.local/bin/uv" ]]; then
		echo "uv is already installed, skipping"
		return
	fi
	echo "Installing uv..."
	curl -LsSf https://astral.sh/uv/install.sh | sh
}

check_prerequisites
install_uv

echo "uv installed successfully."
echo "Run 'source ~/.bashrc' or open a new shell to use uv."
