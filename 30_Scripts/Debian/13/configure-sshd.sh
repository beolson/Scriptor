#!/usr/bin/env bash
set -euo pipefail

GITHUB_USER="${1:-}"

echo "[configure-sshd] Starting..."

# 1. Install openssh-server if not present
if ! dpkg -l openssh-server &>/dev/null 2>&1; then
	echo "[configure-sshd] Installing openssh-server..."
	sudo apt-get install -y openssh-server
else
	echo "[configure-sshd] openssh-server already installed."
fi

# 2. Install ssh-import-id if a GitHub user was provided
if [[ -n "${GITHUB_USER}" ]]; then
	if ! command -v ssh-import-id &>/dev/null; then
		echo "[configure-sshd] Installing ssh-import-id..."
		sudo apt-get install -y ssh-import-id
	fi
fi

# 3. Write Mozilla Modern hardening drop-in
echo "[configure-sshd] Writing Mozilla OpenSSH hardening config..."
sudo tee /etc/ssh/sshd_config.d/99-mozilla-hardening.conf > /dev/null << 'SSHCONF'
# Mozilla Modern SSH hardening
# https://infosec.mozilla.org/guidelines/openssh.html

HostKey /etc/ssh/ssh_host_ed25519_key
HostKey /etc/ssh/ssh_host_rsa_key
HostKey /etc/ssh/ssh_host_ecdsa_key

KexAlgorithms curve25519-sha256@libssh.org,ecdh-sha2-nistp521,ecdh-sha2-nistp384,ecdh-sha2-nistp256,diffie-hellman-group-exchange-sha256
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com,umac-128-etm@openssh.com,hmac-sha2-512,hmac-sha2-256,umac-128@openssh.com

LogLevel VERBOSE
AuthenticationMethods publickey
PubkeyAuthentication yes
PasswordAuthentication no
PermitRootLogin no
ChallengeResponseAuthentication no
SSHCONF

# 4. Ensure base sshd_config doesn't contradict the drop-in
echo "[configure-sshd] Patching base sshd_config to disable password auth and root login..."
sudo sed -i 's/^#*\s*PasswordAuthentication\s.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#*\s*PermitRootLogin\s.*/PermitRootLogin no/' /etc/ssh/sshd_config

# 5. Harden DH moduli (>= 3072-bit)
echo "[configure-sshd] Filtering /etc/ssh/moduli to >= 3072-bit primes..."
awk '$5 >= 3071' /etc/ssh/moduli > /tmp/moduli.safe
sudo mv /tmp/moduli.safe /etc/ssh/moduli

# 6. Validate config before restarting
echo "[configure-sshd] Validating sshd configuration..."
sudo sshd -t

# 7. Restart sshd
echo "[configure-sshd] Restarting sshd..."
sudo systemctl restart sshd
echo "[configure-sshd] sshd restarted successfully."

# 8. Import GitHub SSH keys and schedule daily sync
if [[ -n "${GITHUB_USER}" ]]; then
	echo "[configure-sshd] Importing SSH keys from GitHub user: ${GITHUB_USER}..."
	ssh-import-id "gh:${GITHUB_USER}"

	echo "[configure-sshd] Scheduling daily key import at 03:00 via cron..."
	(crontab -l 2>/dev/null | grep -v "ssh-import-id"; echo "0 3 * * * /usr/bin/ssh-import-id gh:${GITHUB_USER}") | crontab -
	echo "[configure-sshd] Cron job installed."
fi

echo "[configure-sshd] Done."
