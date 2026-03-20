#!/usr/bin/env bash
set -euo pipefail

REGISTRY_URL="${1:-}"
AUTH_TOKEN="${2:-}"
SCOPE="${3:-}"

echo "[configure-npm-remote] Starting..."

if [[ -z "${REGISTRY_URL}" ]]; then
	echo "[configure-npm-remote] Error: registry URL is required." >&2
	exit 1
fi

# Extract hostname for auth token line (strip protocol and trailing path)
REGISTRY_HOST=$(echo "${REGISTRY_URL}" | sed 's|https\?://||' | sed 's|/.*||')

# If no auth token provided, try gh CLI
if [[ -z "${AUTH_TOKEN}" ]] && command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
	echo "[configure-npm-remote] No auth token provided; using token from gh CLI..."
	AUTH_TOKEN=$(gh auth token)
fi

NPMRC="${HOME}/.npmrc"
touch "${NPMRC}"

echo "[configure-npm-remote] Updating ${NPMRC}..."

# Remove existing entries for this registry/scope to ensure idempotency
if [[ -n "${SCOPE}" ]]; then
	sed -i "/^${SCOPE}:registry=/d" "${NPMRC}"
else
	sed -i "/^registry=/d" "${NPMRC}"
fi
sed -i "/^\/\/${REGISTRY_HOST}\/:_authToken=/d" "${NPMRC}"

# Write registry line
if [[ -n "${SCOPE}" ]]; then
	echo "[configure-npm-remote] Setting ${SCOPE} registry to ${REGISTRY_URL}..."
	echo "${SCOPE}:registry=${REGISTRY_URL}" >> "${NPMRC}"
else
	echo "[configure-npm-remote] Setting global registry to ${REGISTRY_URL}..."
	echo "registry=${REGISTRY_URL}" >> "${NPMRC}"
fi

# Write auth token if available
if [[ -n "${AUTH_TOKEN}" ]]; then
	echo "[configure-npm-remote] Writing auth token for ${REGISTRY_HOST}..."
	echo "//${REGISTRY_HOST}/:_authToken=${AUTH_TOKEN}" >> "${NPMRC}"
fi

echo "[configure-npm-remote] Done."
