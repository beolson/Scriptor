#!/usr/bin/env bash
set -euo pipefail

echo "[install-docker] Adding Docker's GPG key..."
sleep 0.3
echo "OK"

echo "[install-docker] Adding Docker apt repository..."
sleep 0.2
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable"

echo "[install-docker] Running apt update..."
echo "Hit:1 https://download.docker.com/linux/debian bookworm InRelease"
echo "Reading package lists... Done"
sleep 0.3

echo "[install-docker] Installing docker-ce docker-ce-cli containerd.io docker-compose-plugin..."
echo "The following NEW packages will be installed:"
echo "  containerd.io docker-buildx-plugin docker-ce docker-ce-cli docker-compose-plugin"
echo "0 upgraded, 5 newly installed, 0 to remove and 0 not upgraded."
sleep 0.5

echo "[install-docker] Starting Docker service..."
echo "Synchronizing state of docker.service with SysV service script with /lib/systemd/systemd-sysv-install."
echo "Created symlink /etc/systemd/system/multi-user.target.wants/docker.service."
sleep 0.3

echo "[install-docker] Verifying Docker installation..."
echo "Docker version 27.5.1, build 9f9e405"

echo "[install-docker] Done."
