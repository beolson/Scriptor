#!/usr/bin/env bash
# ---
# platform: debian-13-x64
# title: Install Bun
# description: Installs Bun, the fast all-in-one JavaScript runtime and package manager.
# ---
# Installs [Bun](https://bun.com) — a fast JavaScript runtime, bundler, and package
# manager — using the official Bun install script.
#
# ## What it does
#
# - Installs `unzip` if not already present (required by the Bun installer)
# - Downloads and runs the official Bun installer via curl
# - Installs Bun to `~/.bun/bin/` and adds it to `PATH` in `~/.bashrc`
# - Skips installation if Bun is already present
#
# ## Requirements
#
# - `curl` must be installed (`sudo apt-get install -y curl`)
# - `sudo` access to install `unzip` if missing
# - Linux kernel 5.6 or higher recommended (`uname -r` to check)

set -euo pipefail
trap 'echo "Script failed on line $LINENO" >&2' ERR

check_prerequisites() {
	if ! command -v curl &>/dev/null; then
		echo "Error: curl is required but not installed. Run: sudo apt-get install -y curl" >&2
		exit 1
	fi
}

ensure_unzip() {
	if command -v unzip &>/dev/null; then
		return
	fi
	echo "Installing unzip (required by the Bun installer)..."
	sudo apt-get install -y unzip
}

install_bun() {
	if command -v bun &>/dev/null || [[ -x "$HOME/.bun/bin/bun" ]]; then
		echo "Bun is already installed, skipping"
		return
	fi
	echo "Installing Bun..."
	curl -fsSL https://bun.com/install | bash
}

check_prerequisites
ensure_unzip
install_bun

echo "Bun installed successfully."
echo "Run 'source ~/.bashrc' or open a new shell to use bun."
