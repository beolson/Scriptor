#!/usr/bin/env bash
# ---
# platform: debian-13-x64
# title: Install Go
# description: Installs Go 1.26.2 from go.dev/dl into /usr/local/go.
# group: debian-13-dev-box
# group_order: 4
# ---
# Installs Go 1.26.2 using the official tarball from [go.dev/dl](https://go.dev/dl/),
# verifying the download against the SHA256 checksum published by the Go team.
#
# ## What it does
#
# 1. Installs `curl` if not present.
# 2. Skips installation if Go 1.26.2 is already present in `/usr/local/go`.
# 3. Downloads the tarball and its SHA256, verifies, then extracts to `/usr/local/`.
# 4. Writes `/etc/profile.d/go.sh` so `/usr/local/go/bin` is on `PATH` for all
#    users after the next login.
#
# ## Requirements
#
# - Regular user with `sudo` access
#
# ## Verifying success
#
# ```
# go version
# ```
#
# ## User package binaries
#
# Tools installed with `go install ...` land in `~/go/bin`. Add that to your
# shell profile to use them without a full path:
# ```
# echo 'export PATH="$PATH:$HOME/go/bin"' >> ~/.profile
# ```

set -euo pipefail
trap 'echo "Script failed on line $LINENO" >&2' ERR

GO_VERSION="go1.26.2"
ARCH="amd64"  # platform: debian-13-x64
INSTALL_DIR="/usr/local"
PROFILE_SCRIPT="/etc/profile.d/go.sh"

# ---------------------------------------------------------------------------
# Sudo — cache credentials upfront, clean up keepalive on exit
# ---------------------------------------------------------------------------
sudo -v
TMP_DIR=$(mktemp -d)
SUDO_PID=""
cleanup() {
	[[ -n "$SUDO_PID" ]] && kill "$SUDO_PID" 2>/dev/null
	rm -rf "${TMP_DIR:?}"
}
trap cleanup EXIT
while true; do sudo -n true; sleep 55; done &
SUDO_PID=$!

# ---------------------------------------------------------------------------
# Ensure curl
# ---------------------------------------------------------------------------
if ! command -v curl &>/dev/null; then
	echo "==> Installing curl..."
	sudo apt-get update -y
	sudo apt-get install -y curl
fi

# ---------------------------------------------------------------------------
# Step 1: Skip if already at this version
# ---------------------------------------------------------------------------
if [[ -x "${INSTALL_DIR}/go/bin/go" ]]; then
	INSTALLED=$("${INSTALL_DIR}/go/bin/go" version | awk '{print $3}')
	if [[ "$INSTALLED" == "$GO_VERSION" ]]; then
		echo "==> ${GO_VERSION} is already installed, nothing to do."
		exit 0
	fi
	echo "==> Upgrading ${INSTALLED} → ${GO_VERSION}..."
else
	echo "==> Installing ${GO_VERSION}..."
fi

# ---------------------------------------------------------------------------
# Step 2: Download and verify tarball
# ---------------------------------------------------------------------------
TARBALL="${GO_VERSION}.linux-${ARCH}.tar.gz"
echo "==> Downloading ${TARBALL}..."
curl -fL "https://go.dev/dl/${TARBALL}" -o "${TMP_DIR}/${TARBALL}"
curl -fL "https://go.dev/dl/${TARBALL}.sha256" -o "${TMP_DIR}/${TARBALL}.sha256"

echo "==> Verifying SHA256..."
echo "$(cat "${TMP_DIR}/${TARBALL}.sha256")  ${TMP_DIR}/${TARBALL}" | sha256sum -c -

# ---------------------------------------------------------------------------
# Step 3: Extract to /usr/local/
# ---------------------------------------------------------------------------
echo "==> Extracting to ${INSTALL_DIR}..."
sudo rm -rf "${INSTALL_DIR}/go"
sudo tar -C "${INSTALL_DIR}" -xzf "${TMP_DIR}/${TARBALL}"

# ---------------------------------------------------------------------------
# Step 4: Add /usr/local/go/bin to PATH for all users
# ---------------------------------------------------------------------------
sudo tee "$PROFILE_SCRIPT" > /dev/null <<'EOF'
# Go toolchain — managed by Scriptor
export PATH="$PATH:/usr/local/go/bin"
EOF
sudo chmod 644 "$PROFILE_SCRIPT"

echo ""
echo "==> Installed: $("${INSTALL_DIR}/go/bin/go" version)"
echo "==> Reload your shell or run: source ${PROFILE_SCRIPT}"
echo "==> User binaries (go install): ~/go/bin"
