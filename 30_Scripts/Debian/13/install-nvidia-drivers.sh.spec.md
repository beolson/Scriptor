## Overview

Installs NVIDIA proprietary drivers on Debian 13 (trixie) using DKMS for kernel module management, along with GPU firmware and CUDA development packages. Supports both the modern DEB822 sources format (`/etc/apt/sources.list.d/debian.sources`) and the traditional `sources.list` format. Supports GTX 700 series through RTX 40xx (Maxwell through Ada Lovelace). **Blackwell/RTX 50xx GPUs are not supported** — those cards require open kernel modules not yet packaged in Debian 13.

## Prerequisites

- Secure Boot must be **disabled** in BIOS/UEFI before the NVIDIA kernel module will load after reboot.
- Run `nvidia-detect` beforehand to confirm your GPU is supported by the packaged driver: `sudo apt-get install -y nvidia-detect && nvidia-detect`

## Steps

1. Enable `contrib`, `non-free`, and `non-free-firmware` components in apt sources (DEB822 or traditional format, idempotent)
2. Run `apt-get update`
3. Install `linux-headers-amd64` (metapackage) — required for DKMS to compile the kernel module; the metapackage keeps headers in sync across kernel upgrades
4. Install `nvidia-kernel-dkms`, `nvidia-driver`, and `firmware-misc-nonfree`
5. Install `nvidia-cuda-dev` and `nvidia-cuda-toolkit`
6. If `xserver-xorg-core` is installed, also install `nvidia-xconfig`

## Verification

```bash
# After reboot, confirm the driver loaded
nvidia-smi

# Confirm DKMS module is registered
dkms status
```

## Post-Install

Reboot the system for the NVIDIA kernel module to load. If an X server is present, run `sudo nvidia-xconfig` after reboot to generate an Xorg configuration file.
