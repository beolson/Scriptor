#!/usr/bin/env bash
# ---
# platform: debian-13-x64
# title: Install NVIDIA Drivers
# description: Installs NVIDIA proprietary drivers and CUDA toolkit via apt on Debian 13 Trixie.
# ---
# Installs NVIDIA graphics drivers and the CUDA toolkit using packages from Debian's
# `non-free` repository. Uses DKMS so the kernel module rebuilds automatically on
# kernel upgrades.
#
# ## Requirements
#
# - **Secure Boot must be disabled** in BIOS/UEFI. The DKMS module is unsigned and will
#   not load with Secure Boot enabled.
# - Regular user with `sudo` access
# - Internet access to reach `deb.debian.org`.
#
# ## What it does
#
# 1. Enables `contrib`, `non-free`, and `non-free-firmware` components in APT sources
#    (supports both the deb822 `.sources` format used by Debian 13 and the legacy
#    `sources.list` format).
# 2. Runs `nvidia-detect` to confirm the recommended driver for your GPU.
# 3. Installs kernel headers, `nvidia-driver`, `nvidia-kernel-dkms`, and
#    `firmware-misc-nonfree`.
# 4. Installs the CUDA development tools (`nvidia-cuda-dev`, `nvidia-cuda-toolkit`).
# 5. Installs `nvidia-xconfig` when an X server is present.
#
# ## Verifying success
#
# After rebooting, run `nvidia-smi` to confirm the driver loaded and inspect GPU info.
# For X11: run `nvidia-xconfig` once post-reboot to generate `/etc/X11/xorg.conf`.
#
# ## Note on open vs. proprietary kernel module
#
# This script installs the proprietary DKMS module (`nvidia-kernel-dkms`), which
# supports all NVIDIA GPU generations. An open-source alternative
# (`nvidia-open-kernel-dkms`) is available for Turing, Ampere, and Ada Lovelace GPUs
# but does **not** support Maxwell, Pascal, or Volta.

set -euo pipefail
trap 'echo "Script failed on line $LINENO" >&2' ERR

echo "=========================================================="
echo "  IMPORTANT: Secure Boot must be disabled in BIOS/UEFI."
echo "  The NVIDIA DKMS module will not load if Secure Boot is"
echo "  enabled. Verify this before continuing."
echo "=========================================================="
read -rp "Secure Boot is disabled — press Enter to continue..."

# ---------------------------------------------------------------------------
# Sudo — cache credentials upfront so we don't prompt mid-script
# ---------------------------------------------------------------------------
sudo -v
while true; do sudo -n true; sleep 55; done &
SUDO_PID=$!
trap 'kill "$SUDO_PID" 2>/dev/null' EXIT

# ---------------------------------------------------------------------------
# Helper: check if a package is installed
# ---------------------------------------------------------------------------
pkg_installed() {
	dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q "install ok installed"
}

# ---------------------------------------------------------------------------
# Step 1: Enable non-free repositories
# ---------------------------------------------------------------------------
DEB822_SOURCES="/etc/apt/sources.list.d/debian.sources"
LEGACY_SOURCES="/etc/apt/sources.list"

if [[ -f "$DEB822_SOURCES" ]]; then
	if grep -q "non-free" "$DEB822_SOURCES"; then
		echo "==> non-free already enabled in ${DEB822_SOURCES}, skipping."
	else
		echo "==> Enabling contrib, non-free, non-free-firmware in ${DEB822_SOURCES}..."
		sudo sed -i 's/^Components: main.*/Components: main contrib non-free non-free-firmware/' "$DEB822_SOURCES"
	fi
elif [[ -f "$LEGACY_SOURCES" ]]; then
	if grep -q "non-free" "$LEGACY_SOURCES"; then
		echo "==> non-free already enabled in ${LEGACY_SOURCES}, skipping."
	else
		echo "==> Enabling contrib, non-free, non-free-firmware in ${LEGACY_SOURCES}..."
		sudo sed -i 's/trixie \+main.*/trixie main contrib non-free non-free-firmware/g' "$LEGACY_SOURCES"
		sudo sed -i 's/trixie-security \+main.*/trixie-security main contrib non-free non-free-firmware/g' "$LEGACY_SOURCES"
		sudo sed -i 's/trixie-updates \+main.*/trixie-updates main contrib non-free non-free-firmware/g' "$LEGACY_SOURCES"
	fi
else
	echo "Error: no APT sources file found (checked ${DEB822_SOURCES} and ${LEGACY_SOURCES})." >&2
	exit 1
fi

sudo apt-get update

# ---------------------------------------------------------------------------
# Step 2: Run nvidia-detect to confirm GPU and recommended driver
# ---------------------------------------------------------------------------
if ! pkg_installed nvidia-detect; then
	echo "==> Installing nvidia-detect..."
	sudo apt-get install -y nvidia-detect
fi

echo "==> Detecting NVIDIA GPU..."
nvidia-detect || true  # exits non-zero when it recommends a specific driver package

# ---------------------------------------------------------------------------
# Step 3: Kernel headers (required for DKMS to build the kernel module)
# ---------------------------------------------------------------------------
KERNEL_VERSION="$(uname -r)"
if pkg_installed "linux-headers-${KERNEL_VERSION}"; then
	echo "==> Kernel headers for ${KERNEL_VERSION} already installed, skipping."
else
	echo "==> Installing kernel headers for ${KERNEL_VERSION}..."
	sudo apt-get install -y "linux-headers-${KERNEL_VERSION}"
fi

# ---------------------------------------------------------------------------
# Step 4: NVIDIA driver, DKMS module, and firmware
# ---------------------------------------------------------------------------
if pkg_installed nvidia-driver; then
	echo "==> nvidia-driver already installed, skipping."
else
	echo "==> Installing nvidia-driver, nvidia-kernel-dkms, firmware-misc-nonfree..."
	sudo apt-get install -y nvidia-driver nvidia-kernel-dkms firmware-misc-nonfree
fi

# ---------------------------------------------------------------------------
# Step 5: CUDA development toolkit
# ---------------------------------------------------------------------------
if pkg_installed nvidia-cuda-toolkit; then
	echo "==> CUDA toolkit already installed, skipping."
else
	echo "==> Installing CUDA development tools..."
	sudo apt-get install -y nvidia-cuda-dev nvidia-cuda-toolkit
fi

# ---------------------------------------------------------------------------
# Step 6: X11 configuration helper (only when an X server is present)
# ---------------------------------------------------------------------------
if pkg_installed xserver-xorg-core; then
	if ! pkg_installed nvidia-xconfig; then
		echo "==> X server detected — installing nvidia-xconfig..."
		sudo apt-get install -y nvidia-xconfig
	fi
	echo "==> After reboot, run: nvidia-xconfig"
fi

echo ""
echo "==> Done. Reboot to load the NVIDIA kernel module."
echo "    After reboot, verify with: nvidia-smi"
