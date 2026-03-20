## Overview

Installs the Bun JS runtime on Debian 13 using the official install script. Optionally configures a private CA bundle for environments that use corporate TLS inspection.

## Steps

1. Install `unzip` (required by the Bun installer)
2. Download and run the official Bun install script from `bun.sh/install`; if a CA bundle is provided, sets `CURL_CA_BUNDLE` so the download succeeds behind corporate TLS inspection
3. If a private CA bundle path is provided, append `NODE_EXTRA_CA_CERTS` to `~/.bashrc` so Bun trusts the bundle at runtime

## Verification

```bash
bun --version
```

## Inputs

- **Private CA bundle path** (optional): filesystem path to a PEM CA bundle (e.g. `/etc/ssl/certs/corporate-ca.pem`). When set, `CURL_CA_BUNDLE` is used during the installer download and `NODE_EXTRA_CA_CERTS` is persisted to `~/.bashrc` for Bun runtime usage. The value is also read from the `PRIVATE_CERTS_FILE` environment variable if not supplied as a TUI input.

## Post-install

Run `source ~/.bashrc` or start a new shell to pick up `~/.bun/bin` in your PATH and the `NODE_EXTRA_CA_CERTS` setting.
