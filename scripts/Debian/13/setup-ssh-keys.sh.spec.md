## Overview

Generates an Ed25519 SSH key pair on Debian 13 using the provided email as the key comment. If the GitHub CLI (`gh`) is installed and authenticated, the public key is automatically uploaded to the user's GitHub account.

## Steps

1. Create `~/.ssh/` with correct permissions (`700`) if it does not exist
2. Generate `~/.ssh/id_ed25519` and `~/.ssh/id_ed25519.pub` (skipped if the key already exists)
3. Print the public key to the terminal
4. If `gh` is installed and `gh auth status` succeeds, add the public key to GitHub with the machine hostname as the title

## Verification

```bash
cat ~/.ssh/id_ed25519.pub   # key exists
gh ssh-key list             # key appears in GitHub (if uploaded)
```

## Inputs

- **Email address** (required): used as the SSH key comment (e.g. `user@example.com`).

## Post-install

To use the key with GitHub, ensure `~/.ssh/id_ed25519.pub` has been added to your account (either via this script or manually at https://github.com/settings/keys).
