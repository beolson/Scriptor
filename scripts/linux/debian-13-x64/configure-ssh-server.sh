#!/usr/bin/env bash
# ---
# platform: debian-13-x64
# title: Configure SSH Server
# description: Hardens sshd, imports GitHub SSH keys, and schedules hourly key refresh.
# ---
# Installs and hardens OpenSSH server on Debian 13 Trixie. Cryptographic settings
# follow the [Mozilla OpenSSH guidelines](https://infosec.mozilla.org/guidelines/openssh)
# and [ssh-audit hardening guide](https://www.sshaudit.com/hardening_guides.html),
# updated for 2025 (includes the `sntrup761x25519-sha512` quantum-resistant KEX).
#
# ## What it does
#
# 1. Installs `openssh-server` and `ssh-import-id` if not already present.
# 2. Imports public keys from a GitHub account into the target user's
#    `~/.ssh/authorized_keys`.
# 3. Adds an hourly cron job to keep those keys in sync with GitHub.
# 4. Writes a hardened drop-in config to
#    `/etc/ssh/sshd_config.d/99-hardening.conf` — the main `sshd_config` is
#    left untouched.
# 5. Validates the full configuration with `sshd -t`, then reloads the service.
#
# ## Requirements
#
# - Regular user with `sudo` access
# - Internet access to reach `deb.debian.org` (package install) and `api.github.com`
#   (key import).
#
# ## Security posture
#
# - **Password logins disabled** — public key authentication only.
# - **Root login disabled** — use a regular user with `sudo`.
# - **Verbose logging** — key fingerprints recorded on every login for auditability.
# - **SFTP audited** — file-access events logged at `AUTHPRIV INFO` level.
#
# ## Verifying success
#
# ```
# ssh-audit localhost        # scan for weak algorithms
# sshd -T | grep -i auth     # confirm AuthenticationMethods
# grep sshd /var/log/auth.log
# ```

set -euo pipefail
trap 'echo "Script failed on line $LINENO" >&2' ERR

# ---------------------------------------------------------------------------
# Sudo — cache credentials upfront so we don't prompt mid-script
# ---------------------------------------------------------------------------
sudo -v
while true; do sudo -n true; sleep 55; done &
SUDO_PID=$!
trap 'kill "$SUDO_PID" 2>/dev/null' EXIT

# ---------------------------------------------------------------------------
# Determine the user whose authorized_keys will be populated
# ---------------------------------------------------------------------------
TARGET_USER="${USER}"
read -rp "Local username to import SSH keys for [${TARGET_USER}] (leave blank to skip key import): " input
TARGET_USER="${input:-$TARGET_USER}"

if [[ -n "$TARGET_USER" ]]; then
	read -rp "GitHub username to import keys from [${TARGET_USER}]: " GH_USER
	GH_USER="${GH_USER:-$TARGET_USER}"
fi

# ---------------------------------------------------------------------------
# Helper: check if a package is fully installed
# ---------------------------------------------------------------------------
pkg_installed() {
	dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q "install ok installed"
}

# ---------------------------------------------------------------------------
# Step 1: Install openssh-server and ssh-import-id
# ---------------------------------------------------------------------------
if pkg_installed openssh-server && pkg_installed ssh-import-id; then
	echo "==> openssh-server and ssh-import-id already installed, skipping."
else
	echo "==> Installing openssh-server and ssh-import-id..."
	sudo apt-get update
	sudo apt-get install -y openssh-server ssh-import-id
fi

# ---------------------------------------------------------------------------
# Step 2: Import SSH public keys from GitHub
# ---------------------------------------------------------------------------
if [[ -n "${TARGET_USER:-}" ]]; then
	echo "==> Importing SSH keys from GitHub for ${GH_USER}..."
	sudo -H -u "$TARGET_USER" ssh-import-id "gh:${GH_USER}"

	# Idempotent hourly cron job to keep keys in sync
	IMPORT_CMD="/usr/bin/ssh-import-id gh:${GH_USER}"
	CRON_ENTRY="0 * * * * ${IMPORT_CMD}"
	if sudo -H -u "$TARGET_USER" crontab -l 2>/dev/null | grep -qF "$IMPORT_CMD"; then
		echo "==> Hourly key-sync cron job already set, skipping."
	else
		echo "==> Adding hourly key-sync cron job..."
		(sudo -H -u "$TARGET_USER" crontab -l 2>/dev/null; echo "$CRON_ENTRY") \
			| sudo -H -u "$TARGET_USER" crontab -
	fi
fi

# ---------------------------------------------------------------------------
# Step 3: Write hardened sshd configuration drop-in
# ---------------------------------------------------------------------------
# /etc/ssh/sshd_config.d/*.conf files are included by the default sshd_config.
# Writing a drop-in avoids clobbering the distribution's main config file.
HARDENING_CONF="/etc/ssh/sshd_config.d/99-hardening.conf"

echo "==> Writing hardened SSH configuration to ${HARDENING_CONF}..."
sudo tee "$HARDENING_CONF" > /dev/null <<'EOF'
# SSH server hardening
# Sources:
#   https://infosec.mozilla.org/guidelines/openssh
#   https://www.sshaudit.com/hardening_guides.html (updated 2025-04-18)

# Preferred host key algorithms (ed25519 first)
HostKey /etc/ssh/ssh_host_ed25519_key
HostKey /etc/ssh/ssh_host_rsa_key
HostKey /etc/ssh/ssh_host_ecdsa_key

# Key exchange: sntrup761 (quantum-resistant) added 2025; curve25519 preferred otherwise
KexAlgorithms sntrup761x25519-sha512@openssh.com,curve25519-sha256,curve25519-sha256@libssh.org,ecdh-sha2-nistp521,ecdh-sha2-nistp384,ecdh-sha2-nistp256,diffie-hellman-group-exchange-sha256

# Authenticated-encryption ciphers only
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr

# ETM (encrypt-then-MAC) variants first
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com,umac-128-etm@openssh.com,hmac-sha2-512,hmac-sha2-256,umac-128@openssh.com

# Public key authentication only — password logins disabled
AuthenticationMethods publickey

# VERBOSE logs the key fingerprint used on each login (clear audit trail)
LogLevel VERBOSE

# SFTP with full file-access audit logging (Debian 13 path)
Subsystem sftp /usr/lib/openssh/sftp-server -f AUTHPRIV -l INFO

# Root login disabled — use a regular user + sudo
PermitRootLogin no
EOF

# ---------------------------------------------------------------------------
# Step 4: Validate config, then reload sshd
# ---------------------------------------------------------------------------
echo "==> Validating SSH configuration..."
sudo sshd -t

echo "==> Reloading SSH service..."
sudo systemctl reload ssh

echo ""
echo "==> Done. Active security settings:"
sudo sshd -T | grep -E "^(kexalgorithms|ciphers|macs|authenticationmethods|permitrootlogin|loglevel)" | sort
