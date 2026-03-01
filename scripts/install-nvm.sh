#!/usr/bin/env bash
set -euo pipefail

echo "[install-nvm] Downloading NVM installer..."
sleep 0.3
echo "  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current"
echo "                                 Dload  Upload   Total   Spent    Left  Speed"
echo "100 15916  100 15916    0     0  87451      0 --:--:-- --:--:-- --:--:-- 87779"

echo "[install-nvm] Installing NVM v0.40.1..."
sleep 0.4
echo "=> Downloading nvm from git to '/home/user/.nvm'"
echo "=> Cloning into '/home/user/.nvm'..."
echo "=> Compressing and cleaning up git repository"

echo "[install-nvm] Appending NVM source to ~/.bashrc..."
echo 'export NVM_DIR="$HOME/.nvm"'
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"'
echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"'

echo ""
echo "=> nvm source string already in /home/user/.bashrc"
echo "=> Close and reopen your terminal to start using nvm or run the following to use it now:"
echo ""
echo "export NVM_DIR=\"\$HOME/.nvm\""
echo "[ -s \"\$NVM_DIR/nvm.sh\" ] && \\. \"\$NVM_DIR/nvm.sh\""

echo "[install-nvm] Done."
