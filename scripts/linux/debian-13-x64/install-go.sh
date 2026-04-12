#!/usr/bin/env bash
# ---
# platform: debian-13-x64
# title: Install Go
# description: Installs the latest stable Go toolchain from go.dev/dl into /usr/local/go.
# group: debian-13-dev-box
# group_order: 4
# ---
# Installs Go using the official tarball from [go.dev/dl](https://go.dev/dl/),
# verifying the download against the SHA256 checksum published by the Go team.
#
# Debian's `golang` package tends to lag several minor versions behind upstream.
# The tarball approach guarantees the current stable release.
#
# ## What it does
#
# 1. Queries `https://go.dev/dl/?mode=json` for the latest stable version and
#    its SHA256 checksum.
# 2. Skips installation if that version is already present in `/usr/local/go`.
# 3. Downloads and verifies the tarball, then extracts it to `/usr/local/`.
# 4. Writes `/etc/profile.d/go.sh` so `/usr/local/go/bin` is on `PATH` for all
#    users after the next login.
#
# ## Requirements
#
# - Run as root or with `sudo`.
# - `curl` must be installed (`sudo apt-get install -y curl`).
# - `python3` must be installed (present by default on Debian 13).
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

# ---------------------------------------------------------------------------
# Must run as root
# ---------------------------------------------------------------------------
if [[ "$(/usr/bin/id -u)" -ne 0 ]]; then
	echo "Error: run as root or with sudo." >&2
	exit 1
fi

if ! command -v curl &>/dev/null; then
	echo "Error: curl is required. Run: sudo apt-get install -y curl" >&2
	exit 1
fi

ARCH="amd64"  # platform: debian-13-x64
INSTALL_DIR="/usr/local"
PROFILE_SCRIPT="/etc/profile.d/go.sh"

# ---------------------------------------------------------------------------
# Step 1: Resolve latest stable version and SHA256 from go.dev
# ---------------------------------------------------------------------------
echo "==> Querying latest stable Go release from go.dev..."
RELEASE_JSON=$(curl -fsSL 'https://go.dev/dl/?mode=json')

read -r LATEST_VERSION SHA256 < <(
	python3 -c "
import json, sys
data = json.load(sys.stdin)
for f in data[0]['files']:
    if f['os'] == 'linux' and f['arch'] == 'amd64' and f['kind'] == 'archive':
        print(data[0]['version'], f['sha256'])
        break
" <<< "$RELEASE_JSON"
)

echo "==> Latest stable: ${LATEST_VERSION}"

# ---------------------------------------------------------------------------
# Step 2: Skip if already at this version
# ---------------------------------------------------------------------------
if [[ -x "${INSTALL_DIR}/go/bin/go" ]]; then
	INSTALLED=$("${INSTALL_DIR}/go/bin/go" version | awk '{print $3}')
	if [[ "$INSTALLED" == "$LATEST_VERSION" ]]; then
		echo "==> ${LATEST_VERSION} is already installed, nothing to do."
		exit 0
	fi
	echo "==> Upgrading ${INSTALLED} → ${LATEST_VERSION}..."
else
	echo "==> Installing ${LATEST_VERSION}..."
fi

# ---------------------------------------------------------------------------
# Step 3: Download and verify tarball
# ---------------------------------------------------------------------------
TMP_DIR=$(mktemp -d)
trap 'rm -rf "${TMP_DIR:?}"' EXIT

TARBALL="${LATEST_VERSION}.linux-${ARCH}.tar.gz"
echo "==> Downloading ${TARBALL}..."
curl -fL "https://go.dev/dl/${TARBALL}" -o "${TMP_DIR}/${TARBALL}"

echo "==> Verifying SHA256..."
echo "${SHA256}  ${TMP_DIR}/${TARBALL}" | sha256sum -c -

# ---------------------------------------------------------------------------
# Step 4: Extract to /usr/local/
# ---------------------------------------------------------------------------
echo "==> Extracting to ${INSTALL_DIR}..."
rm -rf "${INSTALL_DIR}/go"
tar -C "${INSTALL_DIR}" -xzf "${TMP_DIR}/${TARBALL}"

# ---------------------------------------------------------------------------
# Step 5: Add /usr/local/go/bin to PATH for all users
# ---------------------------------------------------------------------------
cat > "$PROFILE_SCRIPT" <<'EOF'
# Go toolchain — managed by Scriptor
export PATH="$PATH:/usr/local/go/bin"
EOF
chmod 644 "$PROFILE_SCRIPT"

echo ""
echo "==> Installed: $("${INSTALL_DIR}/go/bin/go" version)"
echo "==> Reload your shell or run: source ${PROFILE_SCRIPT}"
echo "==> User binaries (go install): ~/go/bin"
