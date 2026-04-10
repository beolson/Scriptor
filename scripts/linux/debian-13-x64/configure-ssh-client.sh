#!/usr/bin/env bash
# ---
# platform: debian-13-x64
# title: Configure SSH Client
# description: Generates an ed25519 SSH key, writes client defaults, and registers the key on GitHub.
# ---
# Sets up the SSH client for the current user account:
#
# 1. Generates `~/.ssh/id_ed25519` with 100 KDF rounds (skips if already present).
# 2. Writes `~/.ssh/config` with sensible connection defaults.
# 3. Sets correct permissions on `~/.ssh/` and key files.
# 4. Authenticates with the GitHub CLI if not already logged in.
# 5. Uploads the public key to GitHub, titled `<hostname>_<YYYY-MM-DD>`.
#
# ## Requirements
#
# - Run as a **regular user** — not root or sudo. SSH client config is per-user.
# - `gh` (GitHub CLI) must be installed. See: *Install GitHub CLI*.
#
# ## Verifying success
#
# After running, test the connection with:
# ```
# ssh -T git@github.com
# ```

set -euo pipefail
trap 'echo "Script failed on line $LINENO" >&2' ERR

# ---------------------------------------------------------------------------
# Must run as a regular user — SSH client config is per-user
# ---------------------------------------------------------------------------
if [[ "$(/usr/bin/id -u)" -eq 0 ]]; then
	echo "Error: run this script as a regular user, not as root or sudo." >&2
	exit 1
fi

# ---------------------------------------------------------------------------
# Check prerequisites
# ---------------------------------------------------------------------------
if ! command -v gh &>/dev/null; then
	echo "Error: gh (GitHub CLI) is not installed. Run 'Install GitHub CLI' first." >&2
	exit 1
fi

# ---------------------------------------------------------------------------
# Gather email for SSH key comment
# ---------------------------------------------------------------------------
EMAIL=$(git config --global user.email 2>/dev/null || true)
if [[ -z "$EMAIL" ]]; then
	read -rp "Email address for SSH key comment: " EMAIL
fi

# ---------------------------------------------------------------------------
# Step 1: Ensure ~/.ssh exists with correct permissions
# ---------------------------------------------------------------------------
SSH_DIR="$HOME/.ssh"
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

# ---------------------------------------------------------------------------
# Step 2: Generate ed25519 key if not already present
# ---------------------------------------------------------------------------
SSH_KEY="${SSH_DIR}/id_ed25519"

if [[ -f "$SSH_KEY" ]]; then
	echo "==> SSH key already exists at ${SSH_KEY}, skipping generation."
else
	echo "==> Generating ed25519 SSH key (you will be prompted for a passphrase)..."
	ssh-keygen -t ed25519 -a 100 -C "$EMAIL" -f "$SSH_KEY"
fi

chmod 600 "$SSH_KEY"
chmod 644 "${SSH_KEY}.pub"

# ---------------------------------------------------------------------------
# Step 3: Write ~/.ssh/config with sensible defaults (idempotent)
# ---------------------------------------------------------------------------
SSH_CONFIG="${SSH_DIR}/config"

if [[ -f "$SSH_CONFIG" ]] && grep -q "AddKeysToAgent" "$SSH_CONFIG"; then
	echo "==> SSH config already contains client defaults, skipping."
else
	echo "==> Writing SSH client defaults to ${SSH_CONFIG}..."
	cat >> "$SSH_CONFIG" <<'EOF'

Host *
    AddKeysToAgent yes
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
    ServerAliveCountMax 3
EOF
	chmod 600 "$SSH_CONFIG"
fi

# ---------------------------------------------------------------------------
# Step 4: Authenticate with GitHub CLI
# ---------------------------------------------------------------------------
if gh auth status &>/dev/null; then
	echo "==> Already authenticated with GitHub."
else
	echo "==> Authenticating with GitHub..."
	gh auth login -h github.com -p https -s admin:public_key
fi

# ---------------------------------------------------------------------------
# Step 5: Upload public key to GitHub
# ---------------------------------------------------------------------------
KEYNAME="${HOSTNAME}_$(date '+%F')"

echo "==> Uploading public key to GitHub as '${KEYNAME}'..."
if gh ssh-key add "${SSH_KEY}.pub" --title "$KEYNAME"; then
	echo "==> Key registered on GitHub."
else
	echo "==> Key upload failed — it may already be registered. Run 'gh ssh-key list' to verify."
fi

echo ""
echo "==> Done. Test the connection with:"
echo "    ssh -T git@github.com"
