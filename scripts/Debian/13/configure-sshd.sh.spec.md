## Overview

Installs `openssh-server` on Debian 13 and hardens it following [Mozilla's OpenSSH Modern guidelines](https://infosec.mozilla.org/guidelines/openssh.html): strong KexAlgorithms/Ciphers/MACs, public-key-only authentication, no root login, and hardened DH moduli. Optionally imports authorized SSH keys from a GitHub account and schedules a daily cron refresh.

## Steps

1. Install `openssh-server` via apt if not already present
2. If a GitHub username is provided, install `ssh-import-id`
3. Write `/etc/ssh/sshd_config.d/99-mozilla-hardening.conf` with Mozilla Modern settings
4. Patch base `/etc/ssh/sshd_config` to disable `PasswordAuthentication` and `PermitRootLogin`
5. Filter `/etc/ssh/moduli` to Diffie-Hellman groups ≥ 3072-bit
6. Validate config with `sshd -t`; abort if invalid
7. Restart `sshd` via systemctl
8. If GitHub username provided: run `ssh-import-id gh:<user>` and install a daily cron job at 03:00

## Verification

```bash
# Check sshd is running
sudo systemctl status sshd

# Confirm hardened settings
sudo sshd -T | grep -E 'passwordauthentication|permitrootlogin|kexalgorithms|ciphers'

# Confirm cron job (if GitHub user was provided)
crontab -l | grep ssh-import-id
```

## Inputs

- **GitHub username** (optional): imports public SSH keys from `https://github.com/<user>.keys` into `~/.ssh/authorized_keys` immediately and schedules a daily refresh at 03:00.
