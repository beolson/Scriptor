#!/usr/bin/env bash
# ---
# platform: debian-13-x64
# title: Install .NET 10 SDK
# description: Installs the .NET 10 SDK using the official Microsoft dotnet-install script.
# group: debian-13-dev-box
# group_order: 2
# ---
# Installs the [.NET 10](https://dotnet.microsoft.com/) SDK on Debian 13 x64
# using the official Microsoft dotnet-install.sh script.
#
# ## What it does
#
# - Installs `curl` and `libicu-dev` if not present
# - Downloads and runs the official Microsoft dotnet-install.sh for the 10.0 channel
# - Configures `DOTNET_ROOT` and `PATH` in `~/.bashrc` if not already set
# - Skips each step if already done
#
# ## Requirements
#
# - Regular user with `sudo` access

set -euo pipefail
trap 'echo "Script failed on line $LINENO" >&2' ERR

# Cache sudo credentials upfront so we don't prompt mid-script
sudo -v
while true; do sudo -n true; sleep 55; done &
SUDO_PID=$!
trap 'kill "$SUDO_PID" 2>/dev/null' EXIT

ensure_deps() {
	local pkgs=()
	command -v curl &>/dev/null || pkgs+=(curl)
	dpkg-query -W libicu-dev &>/dev/null || pkgs+=(libicu-dev)
	if [[ ${#pkgs[@]} -gt 0 ]]; then
		echo "Installing missing packages: ${pkgs[*]}..."
		sudo apt-get update -y
		sudo apt-get install -y "${pkgs[@]}"
	fi
}

dotnet_10_installed() {
	local sdk_dir="$HOME/.dotnet/sdk"
	[[ -d "$sdk_dir" ]] || return 1
	for dir in "$sdk_dir"/10.*; do
		[[ -d "$dir" ]] && return 0
	done
	return 1
}

install_dotnet() {
	if dotnet_10_installed; then
		echo ".NET 10 SDK is already installed, skipping"
		return
	fi
	echo "Installing .NET 10 SDK..."
	curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 10.0
}

configure_path() {
	local bashrc="$HOME/.bashrc"
	if grep -q 'DOTNET_ROOT' "$bashrc" 2>/dev/null; then
		echo "DOTNET_ROOT already configured in ~/.bashrc, skipping"
		return
	fi
	echo "Configuring DOTNET_ROOT and PATH in ~/.bashrc..."
	cat >> "$bashrc" <<'EOF'

export DOTNET_ROOT=$HOME/.dotnet
export PATH=$PATH:$DOTNET_ROOT:$DOTNET_ROOT/tools
EOF
}

ensure_deps
install_dotnet
configure_path

echo ".NET 10 SDK installed successfully."
echo "Run 'source ~/.bashrc' or open a new shell to use dotnet."
