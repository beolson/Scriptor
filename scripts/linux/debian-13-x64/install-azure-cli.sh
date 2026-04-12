#!/usr/bin/env bash
# ---
# platform: debian-13-x64
# title: Install Azure CLI and Azure Developer CLI
# description: Installs az (Azure CLI) and azd (Azure Developer CLI) using official Microsoft install scripts.
# group: debian-13-dev-box
# group_order: 6
# ---
# Installs the Azure CLI (`az`) and Azure Developer CLI (`azd`) on Debian 13 x64
# using the official Microsoft install scripts.
#
# ## What it does
#
# - Installs `az` via the official Microsoft Debian install script (requires sudo)
# - Installs `azd` via the official Microsoft install script
# - Skips each tool if it is already installed
#
# ## Requirements
#
# - `curl` must be installed (`sudo apt-get install -y curl`)
# - `sudo` access for installing `az`

set -euo pipefail
trap 'echo "Script failed on line $LINENO" >&2' ERR

check_prerequisites() {
	if ! command -v curl &>/dev/null; then
		echo "Error: curl is required but not installed. Run: sudo apt-get install -y curl" >&2
		exit 1
	fi
}

install_az() {
	if command -v az &>/dev/null; then
		echo "az is already installed, skipping"
		return
	fi
	echo "Installing Azure CLI (az)..."
	curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
}

install_azd() {
	if command -v azd &>/dev/null; then
		echo "azd is already installed, skipping"
		return
	fi
	echo "Installing Azure Developer CLI (azd)..."
	curl -fsSL https://aka.ms/install-azd.sh | bash
}

check_prerequisites
install_az
install_azd

echo "az and azd installed successfully."
echo "Run 'source ~/.bashrc' or open a new shell to pick up any PATH changes."
