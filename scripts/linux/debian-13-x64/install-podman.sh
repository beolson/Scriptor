#!/usr/bin/env bash
# ---
# platform: debian-13-x64
# title: Install Podman
# description: Installs Podman and configures rootless containers for the current user.
# ---
# Installs [Podman](https://podman.io/) from the Debian 13 Trixie repository
# (currently Podman 5.x) and configures rootless container support for the
# invoking user.
#
# Unlike Docker, Podman is daemonless and rootless by design — containers run
# as the user's own processes without a privileged background service.
#
# ## What it does
#
# 1. Installs `podman` and its rootless dependencies:
#    `crun`, `dbus-user-session`, `fuse-overlayfs`, `slirp4netns`, `uidmap`.
# 2. Ensures `/etc/subuid` and `/etc/subgid` contain a valid UID/GID range for
#    the target user (required for rootless user namespaces).
# 3. Enables systemd **linger** for the user so podman services survive logout.
# 4. Runs a smoke test as the target user (`podman run --rm hello-world`).
#
# ## Requirements
#
# - Regular user with `sudo` access
# - Kernel must support cgroup v2 (default on Debian 13).
#
# ## Verifying success
#
# ```
# podman --version
# podman info | grep -E 'rootless|cgroupVersion'
# podman run --rm hello-world
# ```
#
# ## Using with minikube
#
# The minikube podman driver is currently **experimental**. If using minikube,
# prefer the Docker driver for stability. If you do use podman:
# ```
# minikube config set rootless true
# minikube start --driver=podman
# ```

set -euo pipefail
trap 'echo "Script failed on line $LINENO" >&2' ERR

# Detect WSL2 — several steps behave differently under WSL
IN_WSL=false
if grep -qi "microsoft-standard-WSL" /proc/version 2>/dev/null; then
	IN_WSL=true
fi

# ---------------------------------------------------------------------------
# Sudo — cache credentials upfront so we don't prompt mid-script
# ---------------------------------------------------------------------------
sudo -v
while true; do sudo -n true; sleep 55; done &
SUDO_PID=$!
trap 'kill "$SUDO_PID" 2>/dev/null' EXIT

# ---------------------------------------------------------------------------
# Determine the user to configure for rootless access
# ---------------------------------------------------------------------------
TARGET_USER="${USER}"

if ! id "$TARGET_USER" &>/dev/null; then
	echo "Error: user '${TARGET_USER}' does not exist." >&2
	exit 1
fi

# ---------------------------------------------------------------------------
# Helper: check if a package is fully installed
# ---------------------------------------------------------------------------
pkg_installed() {
	dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q "install ok installed"
}

# ---------------------------------------------------------------------------
# Step 1: Install podman and rootless dependencies
# ---------------------------------------------------------------------------
PACKAGES=(podman crun dbus-user-session fuse-overlayfs slirp4netns uidmap)
MISSING=()

for pkg in "${PACKAGES[@]}"; do
	pkg_installed "$pkg" || MISSING+=("$pkg")
done

if [[ "${#MISSING[@]}" -eq 0 ]]; then
	echo "==> All podman packages already installed, skipping."
else
	echo "==> Installing: ${MISSING[*]}..."
	sudo apt-get update
	sudo apt-get install -y "${MISSING[@]}"
fi

# ---------------------------------------------------------------------------
# Step 2: Configure subordinate UID/GID ranges for rootless namespaces
# ---------------------------------------------------------------------------
# Debian 13 creates these entries automatically for users added via adduser,
# but may miss users created with useradd. Verify and add if absent.

SUBUID_FILE="/etc/subuid"
SUBGID_FILE="/etc/subgid"
SUBID_RANGE="100000-165535"  # 65536 IDs — standard rootless allocation

if grep -q "^${TARGET_USER}:" "$SUBUID_FILE" 2>/dev/null; then
	echo "==> subuid already configured for ${TARGET_USER}, skipping."
else
	echo "==> Adding subuid range for ${TARGET_USER}..."
	sudo usermod --add-subuids "$SUBID_RANGE" "$TARGET_USER"
fi

if grep -q "^${TARGET_USER}:" "$SUBGID_FILE" 2>/dev/null; then
	echo "==> subgid already configured for ${TARGET_USER}, skipping."
else
	echo "==> Adding subgid range for ${TARGET_USER}..."
	sudo usermod --add-subgids "$SUBID_RANGE" "$TARGET_USER"
fi

# ---------------------------------------------------------------------------
# Step 3: WSL2 workarounds — cgroupfs manager and file-based event logging
# ---------------------------------------------------------------------------
# WSL2's systemd support is incomplete: the user-level systemd session is
# often unavailable, causing podman to fail with:
#   WARN: The cgroupv2 manager is set to systemd but there is no systemd
#         user session available
# Fix: override cgroup_manager to cgroupfs and events_logger to file for
# the target user. These settings only affect rootless (user-level) podman.

TARGET_HOME=$(getent passwd "$TARGET_USER" | cut -d: -f6)
CONTAINERS_CONF="${TARGET_HOME}/.config/containers/containers.conf"

if [[ "$IN_WSL" == "true" ]]; then
	echo "==> WSL2 detected — applying podman cgroup and logging workarounds..."
	if grep -q "cgroup_manager" "$CONTAINERS_CONF" 2>/dev/null; then
		echo "==> containers.conf already configured, skipping."
	else
		mkdir -p "${TARGET_HOME}/.config/containers"
		tee "$CONTAINERS_CONF" > /dev/null <<'EOF'
[engine]
# WSL2: systemd user sessions are unreliable — use cgroupfs instead
cgroup_manager = "cgroupfs"
# WSL2: journald is unavailable — write events to a file instead
events_logger = "file"
EOF
		echo "==> containers.conf written to ${CONTAINERS_CONF}"
	fi
else
	echo "==> Not WSL2, skipping cgroup workarounds."
fi

# ---------------------------------------------------------------------------
# Step 4: Enable systemd linger so user services survive logout
# ---------------------------------------------------------------------------
if [[ "$IN_WSL" == "true" ]]; then
	echo "==> WSL2: skipping loginctl linger (systemd user sessions unreliable)."
elif loginctl show-user "$TARGET_USER" 2>/dev/null | grep -q "Linger=yes"; then
	echo "==> Systemd linger already enabled for ${TARGET_USER}, skipping."
else
	echo "==> Enabling systemd linger for ${TARGET_USER}..."
	sudo loginctl enable-linger "$TARGET_USER"
fi

# ---------------------------------------------------------------------------
# Step 5: Smoke test — pull and run hello-world as the target user
# ---------------------------------------------------------------------------
echo "==> Running smoke test (podman run --rm hello-world) as ${TARGET_USER}..."
if sudo -H -u "$TARGET_USER" podman run --rm hello-world &>/dev/null; then
	echo "==> Smoke test passed."
else
	echo "!!! Smoke test failed — you may need to log out and back in for"
	echo "    subuid/subgid changes to take effect, then re-run this script."
fi

echo ""
echo "==> Podman installed: $(podman --version)"
if [[ "$IN_WSL" == "true" ]]; then
	echo "==> WSL2 mode: cgroup_manager=cgroupfs, events_logger=file"
fi
echo "==> Run containers as ${TARGET_USER} — no sudo needed:"
echo "    podman run --rm -it debian:trixie bash"
