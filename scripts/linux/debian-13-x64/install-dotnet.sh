#!/usr/bin/env bash
# ---
# platform: debian-13-x64
# title: Install .NET 10 SDK
# description: Installs the .NET 10 SDK using the official Microsoft dotnet-install script.
# ---
# Installs the [.NET 10](https://dotnet.microsoft.com/) SDK on Debian 13 x64
# using the official Microsoft dotnet-install.sh script.
#
# ## What it does
#
# - Installs `libicu-dev` if not present (required by .NET on Linux)
# - Downloads and runs the official Microsoft dotnet-install.sh for the 10.0 channel
# - Configures `DOTNET_ROOT` and `PATH` in `~/.bashrc` if not already set
# - Skips each step if already done
#
# ## Requirements
#
# - `curl` must be installed (`sudo apt-get install -y curl`)
# - `sudo` access to install `libicu-dev`

set -euo pipefail
trap 'echo "Script failed on line $LINENO" >&2' ERR

check_prerequisites() {
	if ! command -v curl &>/dev/null; then
		echo "Error: curl is required but not installed. Run: sudo apt-get install -y curl" >&2
		exit 1
	fi
}

ensure_libicu() {
	if dpkg-query -W libicu-dev &>/dev/null; then
		echo "libicu-dev is already installed, skipping"
		return
	fi
	echo "Installing libicu-dev..."
	sudo apt-get install -y libicu-dev
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

check_prerequisites
ensure_libicu
install_dotnet
configure_path

echo ".NET 10 SDK installed successfully."
echo "Run 'source ~/.bashrc' or open a new shell to use dotnet."
