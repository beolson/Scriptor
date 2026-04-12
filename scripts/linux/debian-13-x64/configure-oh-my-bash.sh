#!/usr/bin/env bash
# ---
# platform: debian-13-x64
# title: Configure Oh My Bash
# description: Installs Oh My Bash with the agnoster theme and JetBrains Mono Nerd Font.
# ---
# Sets up Oh My Bash on Debian 13 with the agnoster theme. Also installs
# JetBrains Mono Nerd Font, which agnoster requires for Powerline glyphs.
#
# ## What it does
#
# 1. Installs `curl`, `unzip`, and `fontconfig` if not present (requires `sudo`)
# 2. Installs Oh My Bash (skips if `~/.oh-my-bash` already exists)
# 3. Sets the Oh My Bash theme to `agnoster` in `~/.bashrc`
# 4. Installs JetBrains Mono Nerd Font to `~/.local/share/fonts/NerdFonts/` (skips if present)
#
# ## Requirements
#
# - Regular user with `sudo` access
# - Internet connection (downloads from GitHub)

set -euo pipefail
trap 'echo "Script failed on line $LINENO" >&2' ERR

# Cache sudo credentials upfront so we don't prompt mid-script
sudo -v
while true; do sudo -n true; sleep 55; done &
SUDO_PID=$!
trap 'kill "$SUDO_PID" 2>/dev/null' EXIT

# ── Dependencies ──────────────────────────────────────────────────────────────

packages_to_install=()
command -v curl    &>/dev/null || packages_to_install+=(curl)
command -v unzip   &>/dev/null || packages_to_install+=(unzip)
command -v fc-cache &>/dev/null || packages_to_install+=(fontconfig)

if [[ ${#packages_to_install[@]} -gt 0 ]]; then
	echo "Installing missing packages: ${packages_to_install[*]}..."
	sudo apt-get update -y
	sudo apt-get install -y "${packages_to_install[@]}"
fi

# ── Oh My Bash ────────────────────────────────────────────────────────────────

if [[ -d "$HOME/.oh-my-bash" ]]; then
	echo "Oh My Bash already installed, skipping."
else
	echo "Installing Oh My Bash..."
	bash -c "$(curl -fsSL https://raw.githubusercontent.com/ohmybash/oh-my-bash/master/tools/install.sh)" "" --unattended
	echo "Oh My Bash installed."
fi

echo "Setting theme to agnoster..."
sed -i 's/^OSH_THEME.*/OSH_THEME="agnoster"/' "$HOME/.bashrc"

# ── Nerd Font ─────────────────────────────────────────────────────────────────

FONT_DIR="$HOME/.local/share/fonts/NerdFonts"

if [[ -d "$FONT_DIR" ]]; then
	echo "Nerd Font already installed, skipping."
else
	echo "Installing JetBrains Mono Nerd Font..."
	mkdir -p "$FONT_DIR"
	tmp_zip=$(mktemp --suffix=.zip)
	curl -fsSL "https://github.com/ryanoasis/nerd-fonts/releases/latest/download/JetBrainsMono.zip" -o "$tmp_zip"
	unzip -q "$tmp_zip" -d "$FONT_DIR"
	rm -f "$tmp_zip"
	fc-cache -f "$FONT_DIR"
	echo "JetBrains Mono Nerd Font installed."
fi

echo "Done. Reload your terminal or run: source ~/.bashrc"
