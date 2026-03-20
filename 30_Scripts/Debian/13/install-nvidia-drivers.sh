#!/usr/bin/env bash
set -euo pipefail

echo "[install-nvidia-drivers] Starting..."
echo "[install-nvidia-drivers] NOTE: Secure Boot must be disabled in BIOS/UEFI before NVIDIA drivers will load."

# Debian 13 defaults to DEB822 format; fall back to traditional sources.list
DEBIAN_SOURCES="/etc/apt/sources.list.d/debian.sources"
if [[ -f "${DEBIAN_SOURCES}" ]]; then
	echo "[install-nvidia-drivers] Enabling contrib, non-free, non-free-firmware in ${DEBIAN_SOURCES}..."
	for component in contrib non-free non-free-firmware; do
		sudo sed -i "/^Components:.*\b${component}\b/!s/^Components: .*/& ${component}/" "${DEBIAN_SOURCES}"
	done
else
	echo "[install-nvidia-drivers] Enabling contrib, non-free, non-free-firmware in /etc/apt/sources.list..."
	sudo sed -i '/^deb .*trixie/ s/\(main\)$/\1 contrib non-free non-free-firmware/' /etc/apt/sources.list
fi

sudo apt-get update -q

# Kernel headers are required for DKMS to build the NVIDIA module.
# Use the metapackage (linux-headers-amd64) so headers stay in sync after kernel upgrades.
echo "[install-nvidia-drivers] Installing kernel headers..."
sudo apt-get install -y linux-headers-amd64

# Proprietary driver + DKMS build infrastructure + firmware
echo "[install-nvidia-drivers] Installing NVIDIA driver..."
sudo apt-get install -y nvidia-kernel-dkms nvidia-driver firmware-misc-nonfree

# CUDA development packages
echo "[install-nvidia-drivers] Installing CUDA toolkit..."
sudo apt-get install -y nvidia-cuda-dev nvidia-cuda-toolkit

# Install nvidia-xconfig only if an X server is present
if dpkg -l xserver-xorg-core &>/dev/null; then
	echo "[install-nvidia-drivers] X server detected, installing nvidia-xconfig..."
	sudo apt-get install -y nvidia-xconfig
	echo "[install-nvidia-drivers] After reboot, run: sudo nvidia-xconfig"
fi

echo "[install-nvidia-drivers] Done. Reboot required for the NVIDIA driver to load."
