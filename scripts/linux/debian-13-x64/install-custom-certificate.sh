#!/usr/bin/env bash
# ---
# platform: debian-13-x64
# title: Install Custom SSL Certificate
# description: Guides you through identifying and trusting a certificate from an SSL inspection proxy such as Zscaler.
# ---
# Connects to a URL, inspects its full certificate chain, and installs
# whichever certificate you choose as a trusted CA on this system.
#
# Useful for SSL inspection proxies (e.g. Zscaler) that inject their own root CA
# into HTTPS traffic. The injected certificate must be trusted for tools like
# `curl`, `apt`, Python, and Node.js to work correctly inside the proxy.
#
# ## What it does
#
# - Prompts for a URL to inspect (default: www.google.com)
# - Fetches and displays the full TLS certificate chain for that URL
# - Lets you select which certificate to install as a trusted CA
# - Copies it to `/usr/local/share/ca-certificates/` and runs `update-ca-certificates`
#
# ## Requirements
#
# - `openssl` must be installed (`sudo apt-get install -y openssl`)
# - `sudo` access to install the certificate
# - Run this from inside the proxy environment so the injected certificate is visible

set -euo pipefail

TMP_DIR=$(mktemp -d)
SUDO_PID=""
cleanup() {
	[[ -n "$SUDO_PID" ]] && kill "$SUDO_PID" 2>/dev/null
	rm -rf "$TMP_DIR"
}
trap cleanup EXIT
trap 'echo "Error on line $LINENO" >&2' ERR

check_prerequisites() {
	for cmd in openssl timeout; do
		if ! command -v "$cmd" &>/dev/null; then
			echo "Error: ${cmd} is required but not installed." >&2
			exit 1
		fi
	done
}

ensure_ca_certificates() {
	if dpkg-query -W ca-certificates &>/dev/null; then
		return
	fi
	echo "Installing ca-certificates package..."
	sudo apt-get install -y ca-certificates
}

prompt_host() {
	local url
	read -r -p "Enter URL to inspect [www.google.com]: " url
	url="${url:-www.google.com}"
	url="${url#https://}"
	url="${url#http://}"
	url="${url%%/*}"
	printf '%s' "$url"
}

fetch_chain() {
	local host="$1"
	echo "Fetching certificate chain from ${host}:443..."
	# Ignore openssl's exit code: SSL inspection proxies cause verification failures
	# (exit 1) even when the cert chain is successfully captured in the output.
	# The grep check below is the only success gate we need.
	timeout 15 openssl s_client -connect "${host}:443" -showcerts \
		</dev/null > "$TMP_DIR/chain.pem" 2>/dev/null || true
	if ! grep -q 'BEGIN CERTIFICATE' "$TMP_DIR/chain.pem" 2>/dev/null; then
		echo "Error: could not retrieve certificate chain from ${host}:443" >&2
		exit 1
	fi
}

extract_certs() {
	awk -v out_dir="$TMP_DIR" '
		/-----BEGIN CERTIFICATE-----/ { n++; f = out_dir "/cert_" n ".pem" }
		f { print > f }
		/-----END CERTIFICATE-----/ { close(f); f = "" }
	' "$TMP_DIR/chain.pem"
}

count_certs() {
	local count=0
	for cert_file in "$TMP_DIR"/cert_*.pem; do
		[[ -f "$cert_file" ]] && (( count += 1 ))
	done
	printf '%d' "$count"
}

show_chain_menu() {
	local host="$1"
	local idx=1
	printf '\nCertificate chain for %s:\n\n' "$host"
	for cert_file in "$TMP_DIR"/cert_*.pem; do
		[[ -f "$cert_file" ]] || continue
		local subject issuer not_after
		subject=$(openssl x509 -noout -subject -in "$cert_file" 2>/dev/null | sed 's/subject=//')
		issuer=$(openssl x509 -noout -issuer -in "$cert_file" 2>/dev/null | sed 's/issuer=//')
		not_after=$(openssl x509 -noout -enddate -in "$cert_file" 2>/dev/null | sed 's/notAfter=//')
		printf '  [%d] Subject: %s\n' "$idx" "$subject"
		printf '      Issuer:  %s\n' "$issuer"
		printf '      Expires: %s\n\n' "$not_after"
		(( idx += 1 ))
	done
}

get_selection() {
	local cert_count="$1"
	local selection
	while true; do
		read -r -p "Select certificate to install as trusted CA [1-${cert_count}]: " selection
		if [[ "$selection" =~ ^[0-9]+$ ]] && \
		   [[ "$selection" -ge 1 ]] && \
		   [[ "$selection" -le "$cert_count" ]]; then
			printf '%s' "$selection"
			return
		fi
		echo "Please enter a number between 1 and ${cert_count}."
	done
}

derive_cert_name() {
	local cert_file="$1"
	local fallback="$2"
	local subject cn sanitized
	# Use RFC2253 for consistent CN=value format (no spaces around =)
	subject=$(openssl x509 -noout -subject -nameopt RFC2253 -in "$cert_file" 2>/dev/null)
	cn="${subject#*CN=}"
	cn="${cn%%,*}"
	cn="${cn% }"
	sanitized=$(printf '%s' "$cn" | tr '[:upper:]' '[:lower:]' | tr -cs '[:alnum:]' '-')
	sanitized="${sanitized#-}"
	sanitized="${sanitized%-}"
	printf '%s' "${sanitized:-$fallback}"
}

install_cert() {
	local cert_file="$1"
	local cert_name="$2"
	local dest="/usr/local/share/ca-certificates/${cert_name}.crt"

	printf '\nInstalling certificate to %s...\n' "$dest"
	sudo cp "$cert_file" "$dest"
	sudo chmod 644 "$dest"
	echo "Updating CA trust store..."
	sudo update-ca-certificates
}

# --- Main ---

# This script has interactive prompts and cannot run via curl | bash.
# Stdin must be a terminal so the URL, certificate selection, and confirmation
# prompts can be answered.
if [[ ! -t 0 ]]; then
	echo "Error: this script requires an interactive terminal." >&2
	echo "Download it first, then run it:" >&2
	echo "  curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/debian-13-x64/install-custom-certificate.sh -o install-cert.sh" >&2
	echo "  bash install-cert.sh" >&2
	exit 1
fi

check_prerequisites
ensure_ca_certificates

# Cache sudo credentials before the interactive certificate selection so the
# install step doesn't prompt mid-flow
sudo -v
while true; do sudo -n true; sleep 55; done &
SUDO_PID=$!

host=$(prompt_host)
fetch_chain "$host"
extract_certs

cert_count=$(count_certs)
if [[ "$cert_count" -eq 0 ]]; then
	echo "Error: no certificates could be extracted from the chain." >&2
	exit 1
fi

echo ""
echo "Tip: SSL inspection proxies inject their own root CA at the end of the"
echo "chain. If you see an unfamiliar issuer, that is likely the one to select."

show_chain_menu "$host"
selection=$(get_selection "$cert_count")

selected_cert="$TMP_DIR/cert_${selection}.pem"
cert_name=$(derive_cert_name "$selected_cert" "custom-ca-${selection}")

printf '\nSelected certificate:\n'
openssl x509 -noout -subject -issuer -dates -in "$selected_cert" 2>/dev/null | sed 's/^/  /'

printf '\n'
read -r -p "Install '${cert_name}' as a trusted CA? [y/N]: " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
	echo "Aborted."
	exit 0
fi

install_cert "$selected_cert" "$cert_name"

printf '\nDone. Certificate "%s" is now trusted system-wide.\n' "$cert_name"
echo "Restart any running applications (curl, apt, Python, Node.js) to pick up the change."
