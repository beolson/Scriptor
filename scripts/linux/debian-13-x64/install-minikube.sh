#!/usr/bin/env bash
# ---
# platform: debian-13-x64
# title: Install Minikube
# description: Installs minikube and kubectl for local Kubernetes development.
# ---
# Installs [minikube](https://minikube.sigs.k8s.io/) and
# [kubectl](https://kubernetes.io/docs/tasks/tools/) from their official
# distribution endpoints, verifying each download against its published SHA256
# checksum. Both are placed in `/usr/local/bin/`.
#
# ## What it does
#
# 1. Installs `conntrack` (required by minikube on Linux).
# 2. Resolves the latest stable kubectl version from `dl.k8s.io/release/stable.txt`,
#    downloads the binary and its SHA256, and installs it if not already current.
# 3. Resolves the latest minikube release from the GitHub API, downloads the
#    binary and its SHA256, and installs it if not already current.
# 4. Checks that Docker is present (recommended driver on Linux).
#
# ## Requirements
#
# - Run as root or with `sudo`.
# - `curl` must be installed (`sudo apt-get install -y curl`).
# - **Docker** must be installed and the user who will run `minikube start`
#   must be in the `docker` group. Docker does not need to be installed before
#   running this script, but minikube will not start without it.
#
# ## Starting your cluster
#
# Run the following as a **regular user** (not root):
# ```
# minikube start --driver=docker
# ```
#
# ## Verifying success
#
# ```
# minikube version
# kubectl version --client
# minikube status
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
BIN_DIR="/usr/local/bin"

# ---------------------------------------------------------------------------
# Helper: check if a package is fully installed
# ---------------------------------------------------------------------------
pkg_installed() {
	dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q "install ok installed"
}

# ---------------------------------------------------------------------------
# Step 1: Install conntrack (required by minikube on Linux)
# ---------------------------------------------------------------------------
if pkg_installed conntrack; then
	echo "==> conntrack already installed, skipping."
else
	echo "==> Installing conntrack..."
	apt-get update
	apt-get install -y conntrack
fi

# ---------------------------------------------------------------------------
# Temp dir — cleaned up on exit
# ---------------------------------------------------------------------------
TMP_DIR=$(mktemp -d)
trap 'rm -rf "${TMP_DIR:?}"' EXIT

# ---------------------------------------------------------------------------
# Step 2: Install kubectl
# ---------------------------------------------------------------------------
echo "==> Resolving latest stable kubectl version..."
KUBECTL_STABLE=$(curl -fsSL 'https://dl.k8s.io/release/stable.txt')
echo "==> Latest stable kubectl: ${KUBECTL_STABLE}"

KUBECTL_INSTALLED=""
if command -v kubectl &>/dev/null; then
	KUBECTL_INSTALLED=$(kubectl version --client -o json 2>/dev/null \
		| python3 -c "import json,sys; print(json.load(sys.stdin)['clientVersion']['gitVersion'])" \
		2>/dev/null || true)
fi

if [[ "$KUBECTL_INSTALLED" == "$KUBECTL_STABLE" ]]; then
	echo "==> kubectl ${KUBECTL_STABLE} already installed, skipping."
else
	[[ -n "$KUBECTL_INSTALLED" ]] && echo "==> Upgrading kubectl ${KUBECTL_INSTALLED} → ${KUBECTL_STABLE}..."

	KUBECTL_URL="https://dl.k8s.io/release/${KUBECTL_STABLE}/bin/linux/${ARCH}/kubectl"
	echo "==> Downloading kubectl ${KUBECTL_STABLE}..."
	curl -fL "$KUBECTL_URL" -o "${TMP_DIR}/kubectl"
	curl -fL "${KUBECTL_URL}.sha256" -o "${TMP_DIR}/kubectl.sha256"

	echo "==> Verifying kubectl SHA256..."
	echo "$(cat "${TMP_DIR}/kubectl.sha256")  ${TMP_DIR}/kubectl" | sha256sum -c -

	install -o root -g root -m 0755 "${TMP_DIR}/kubectl" "${BIN_DIR}/kubectl"
	echo "==> kubectl installed: $(kubectl version --client --short 2>/dev/null || kubectl version --client)"
fi

# ---------------------------------------------------------------------------
# Step 3: Install minikube
# ---------------------------------------------------------------------------
echo "==> Resolving latest minikube release..."
MINIKUBE_LATEST=$(curl -fsSL 'https://api.github.com/repos/kubernetes/minikube/releases/latest' \
	| python3 -c "import json,sys; print(json.load(sys.stdin)['tag_name'])")
echo "==> Latest minikube: ${MINIKUBE_LATEST}"

MINIKUBE_INSTALLED=""
if command -v minikube &>/dev/null; then
	MINIKUBE_INSTALLED=$(minikube version --short 2>/dev/null || true)
fi

if [[ "$MINIKUBE_INSTALLED" == "$MINIKUBE_LATEST" ]]; then
	echo "==> minikube ${MINIKUBE_LATEST} already installed, skipping."
else
	[[ -n "$MINIKUBE_INSTALLED" ]] && echo "==> Upgrading minikube ${MINIKUBE_INSTALLED} → ${MINIKUBE_LATEST}..."

	MINIKUBE_BASE="https://storage.googleapis.com/minikube/releases/${MINIKUBE_LATEST}"
	echo "==> Downloading minikube ${MINIKUBE_LATEST}..."
	curl -fL "${MINIKUBE_BASE}/minikube-linux-${ARCH}" -o "${TMP_DIR}/minikube"
	curl -fL "${MINIKUBE_BASE}/minikube-linux-${ARCH}.sha256" -o "${TMP_DIR}/minikube.sha256"

	echo "==> Verifying minikube SHA256..."
	echo "$(cat "${TMP_DIR}/minikube.sha256")  ${TMP_DIR}/minikube" | sha256sum -c -

	install -o root -g root -m 0755 "${TMP_DIR}/minikube" "${BIN_DIR}/minikube"
	echo "==> minikube installed: $(minikube version --short)"
fi

# ---------------------------------------------------------------------------
# Step 4: Detect container runtime and print driver instructions
# ---------------------------------------------------------------------------
echo ""
if command -v docker &>/dev/null; then
	echo "==> Docker detected: $(docker --version)"
	echo "    Ensure the user who will run minikube is in the docker group:"
	echo "    sudo usermod -aG docker \$USER  (then log out and back in)"
	echo ""
	echo "==> Start your cluster (as a regular user):"
	echo "    minikube start --driver=docker"
elif command -v podman &>/dev/null; then
	echo "==> Podman detected: $(podman --version)"
	echo "    Note: the podman driver is experimental in minikube."
	echo "    For rootless podman (recommended), enable it first:"
	echo "    minikube config set rootless true"
	echo ""
	echo "==> Start your cluster (as a regular user):"
	echo "    minikube start --driver=podman"
else
	echo "!!! No container runtime found — install Docker or Podman before"
	echo "    running 'minikube start'."
	echo "    Docker (stable driver): minikube start --driver=docker"
	echo "    Podman (experimental):  minikube start --driver=podman"
fi
