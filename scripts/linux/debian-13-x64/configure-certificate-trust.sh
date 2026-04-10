#!/usr/bin/env bash
# ---
# platform: debian-13-x64
# title: Configure Tools to Trust Custom SSL Certificate
# description: Configures installed developer tools to trust a custom CA certificate installed on this system.
# ---
# After running `install-custom-certificate` to add a custom CA to the system
# trust store, run this script to configure individual developer tools that
# maintain their own TLS settings rather than reading the system trust store.
#
# Safe to run at any time — each step is idempotent and will update an
# existing configuration if the certificate path has changed.
#
# ## Tools configured (when installed)
#
# - **node / bun / npm**: `NODE_EXTRA_CA_CERTS` → individual cert file
#   Node does not read the system trust store; this variable appends extra trust
#   on top of Node's built-in bundle.
#
# - **python / uv / pip / az**: `REQUESTS_CA_BUNDLE` → system CA bundle
#   This variable *replaces* Python's built-in certifi bundle, so it must point
#   to a full bundle. `/etc/ssl/certs/ca-certificates.crt` is used — the system
#   bundle that already includes the custom cert after `update-ca-certificates`.
#   Note: az 2.77.0+ (Python 3.13) requires the proxy cert to have the Authority
#   Key Identifier (AKI) extension. If `az login` still fails, see the note at
#   the bottom of the script output.
#
# - **azd (Azure Developer CLI)**: Go binary — reads the system trust store
#   directly. No extra configuration needed after `update-ca-certificates`.
#
# - **git**: `http.sslCAInfo` → system CA bundle
#   Like `REQUESTS_CA_BUNDLE`, this replaces git's default CA file, so the full
#   system bundle is used rather than the individual cert.
#
# - **dotnet**: uses the system trust store — no action needed after `update-ca-certificates`
#
# ## Requirements
#
# - A certificate must already be installed to `/usr/local/share/ca-certificates/`
#   (use `install-custom-certificate.sh` to do this)
# - `openssl` for reading certificate subjects

set -euo pipefail
trap 'echo "Error on line $LINENO" >&2' ERR

BASHRC="$HOME/.bashrc"
# The full system CA bundle. update-ca-certificates keeps this up to date.
# Tools that replace their bundle (python, git) should point here, not to the
# individual cert file, so they continue to trust all standard CAs as well.
SYSTEM_CA_BUNDLE="/etc/ssl/certs/ca-certificates.crt"
CHANGES=0

# Sets or updates a single `export VAR=value` line in ~/.bashrc, idempotently.
# Updates the value in-place if the variable already exists; appends if not.
set_bashrc_var() {
	local var_name="$1"
	local var_value="$2"
	local new_line="export ${var_name}=${var_value}"

	if grep -q "^export ${var_name}=" "$BASHRC" 2>/dev/null; then
		local existing
		existing=$(grep "^export ${var_name}=" "$BASHRC" | tail -1)
		if [[ "$existing" == "$new_line" ]]; then
			printf '    %-44s already set\n' "$var_name"
			return
		fi
		sed -i "s|^export ${var_name}=.*|${new_line}|" "$BASHRC"
		printf '    %-44s updated in ~/.bashrc\n' "$var_name"
	else
		echo "$new_line" >> "$BASHRC"
		printf '    %-44s added to ~/.bashrc\n' "$var_name"
	fi
	(( CHANGES += 1 ))
}

find_custom_certs() {
	mapfile -t cert_files < <(find /usr/local/share/ca-certificates -name '*.crt' -type f 2>/dev/null | sort)
}

select_cert() {
	local count="${#cert_files[@]}"

	if [[ "$count" -eq 0 ]]; then
		echo "Error: no custom certificates found in /usr/local/share/ca-certificates/" >&2
		echo "Run install-custom-certificate.sh first to install a certificate." >&2
		exit 1
	fi

	if [[ "$count" -eq 1 ]]; then
		CERT_PATH="${cert_files[0]}"
		local subject
		subject=$(openssl x509 -noout -subject -in "$CERT_PATH" 2>/dev/null | sed 's/subject=//')
		printf 'Using certificate: %s\n' "$CERT_PATH"
		printf '  Subject: %s\n' "$subject"
		return
	fi

	printf '\nAvailable custom certificates:\n\n'
	local idx=1
	for cert in "${cert_files[@]}"; do
		local subject
		subject=$(openssl x509 -noout -subject -in "$cert" 2>/dev/null | sed 's/subject=//')
		printf '  [%d] %s\n' "$idx" "$cert"
		printf '      %s\n\n' "$subject"
		(( idx += 1 ))
	done

	local selection
	while true; do
		read -r -p "Select certificate to configure tools for [1-${count}]: " selection
		if [[ "$selection" =~ ^[0-9]+$ ]] && \
		   [[ "$selection" -ge 1 ]] && \
		   [[ "$selection" -le "$count" ]]; then
			CERT_PATH="${cert_files[$(( selection - 1 ))]}"
			break
		fi
		echo "Please enter a number between 1 and ${count}."
	done
}

configure_node() {
	local cert_path="$1"
	if ! command -v node &>/dev/null && \
	   ! command -v bun &>/dev/null && \
	   ! command -v npm &>/dev/null; then
		return
	fi
	printf '\n  [node / bun]\n'
	# NODE_EXTRA_CA_CERTS appends to Node's built-in bundle, so the individual
	# cert file is correct here (no need to supply the full system bundle).
	set_bashrc_var "NODE_EXTRA_CA_CERTS" "$cert_path"
}

configure_python() {
	if ! command -v python3 &>/dev/null && \
	   ! command -v python &>/dev/null && \
	   ! command -v uv &>/dev/null && \
	   ! command -v pip3 &>/dev/null; then
		return
	fi
	printf '\n  [python / uv / pip]\n'
	# Point to the full system bundle, not the individual cert file.
	# REQUESTS_CA_BUNDLE replaces certifi's built-in bundle entirely; using only
	# the proxy cert would break trust for all other CAs (GitHub, PyPI, etc.).
	set_bashrc_var "REQUESTS_CA_BUNDLE" "$SYSTEM_CA_BUNDLE"
}

configure_azure() {
	if ! command -v az &>/dev/null && ! command -v azd &>/dev/null; then
		return
	fi
	printf '\n  [az / azd]\n'
	if command -v az &>/dev/null; then
		# az is Python-based and shares REQUESTS_CA_BUNDLE with other Python tools.
		set_bashrc_var "REQUESTS_CA_BUNDLE" "$SYSTEM_CA_BUNDLE"
	fi
	# azd is a Go binary and reads the system trust store directly.
	# No environment variable is needed for azd after update-ca-certificates.
	if command -v azd &>/dev/null; then
		printf '    %-44s system trust store (no action needed)\n' "azd"
	fi
}

configure_git() {
	if ! command -v git &>/dev/null; then
		return
	fi
	printf '\n  [git]\n'
	# http.sslCAInfo replaces git's default CA file, so point to the full system
	# bundle rather than the individual cert.
	local current
	current=$(git config --global http.sslCAInfo 2>/dev/null || true)
	if [[ "$current" == "$SYSTEM_CA_BUNDLE" ]]; then
		printf '    %-44s already set\n' "http.sslCAInfo"
		return
	fi
	git config --global http.sslCAInfo "$SYSTEM_CA_BUNDLE"
	if [[ -n "$current" ]]; then
		printf '    %-44s updated in ~/.gitconfig\n' "http.sslCAInfo"
	else
		printf '    %-44s added to ~/.gitconfig\n' "http.sslCAInfo"
	fi
	(( CHANGES += 1 ))
}

configure_dotnet() {
	if ! command -v dotnet &>/dev/null && [[ ! -x "$HOME/.dotnet/dotnet" ]]; then
		return
	fi
	printf '\n  [dotnet]\n'
	printf '    %-44s system trust store (no action needed)\n' "dotnet"
}

# --- Main ---

CERT_PATH=""
declare -a cert_files

find_custom_certs
select_cert

printf '\nConfiguring developer tools to trust: %s\n' "$CERT_PATH"

configure_node "$CERT_PATH"
configure_python
configure_azure
configure_git
configure_dotnet

printf '\n'
if [[ "$CHANGES" -gt 0 ]]; then
	printf '%d change(s) made. Run '\''source ~/.bashrc'\'' or open a new shell for changes to take effect.\n' "$CHANGES"
else
	printf 'All tools already configured — no changes needed.\n'
fi

# Note: az login (MSAL) in az 2.77.0+ (Python 3.13) applies stricter certificate
# validation and requires your proxy CA to have the Authority Key Identifier (AKI)
# extension. If `az login` still fails after running this script, check whether
# your certificate has AKI:
#   openssl x509 -noout -text -in "$CERT_PATH" | grep -A1 "Authority Key Identifier"
# If AKI is missing, ask your network team to reissue the certificate with AKI,
# or as a last resort set: export AZURE_CLI_DISABLE_CONNECTION_VERIFICATION=1
