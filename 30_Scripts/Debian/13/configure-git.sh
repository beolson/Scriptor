#!/usr/bin/env bash
set -euo pipefail

NAME="${1}"
EMAIL="${2}"

echo "[configure-git] Starting..."

git config --global user.name "${NAME}"
git config --global user.email "${EMAIL}"

echo "[configure-git] Git configured:"
echo "[configure-git]   user.name  = $(git config --global user.name)"
echo "[configure-git]   user.email = $(git config --global user.email)"

echo "[configure-git] Done."
