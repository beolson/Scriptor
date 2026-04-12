#!/usr/bin/env bash
# ---
# platform: debian-13-x64
# title: Install Bun
# description: Installs Bun, the fast all-in-one JavaScript runtime and package manager.
# group: debian-13-dev-box
# group_order: 3
# ---
# Installs [Bun](https://bun.com) — a fast JavaScript runtime, bundler, and package
# manager — using the official Bun install script.
#
# ## What it does
#
# - Installs `curl` and `unzip` if not already present
# - Downloads and runs the official Bun installer via curl
# - Installs Bun to `~/.bun/bin/` and adds it to `PATH` in `~/.bashrc`
# - Skips installation if Bun is already present
#
# ## Requirements
#
# - Regular user with `sudo` access
# - Linux kernel 5.6 or higher recommended (`uname -r` to check)

set -euo pipefail
trap 'echo "Script failed on line $LINENO" >&2' ERR

# Cache sudo credentials upfront so we don't prompt mid-script
sudo -v
while true; do sudo -n true; sleep 55; done &
SUDO_PID=$!
trap 'kill "$SUDO_PID" 2>/dev/null' EXIT

ensure_deps() {
	local pkgs=()
	command -v curl  &>/dev/null || pkgs+=(curl)
	command -v unzip &>/dev/null || pkgs+=(unzip)
	if [[ ${#pkgs[@]} -gt 0 ]]; then
		echo "Installing missing packages: ${pkgs[*]}..."
		sudo apt-get update -y
		sudo apt-get install -y "${pkgs[@]}"
	fi
}

install_bun() {
	if command -v bun &>/dev/null || [[ -x "$HOME/.bun/bin/bun" ]]; then
		echo "Bun is already installed, skipping"
		return
	fi
	echo "Installing Bun..."
	curl -fsSL https://bun.com/install | bash
}

ensure_deps
install_bun

echo "Bun installed successfully."
echo "Run 'source ~/.bashrc' or open a new shell to use bun."
