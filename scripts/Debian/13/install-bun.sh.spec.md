## Overview

Installs the Bun JS runtime on Debian 13 using the official install script. Optionally configures a private CA bundle for environments that use corporate TLS inspection.

## Steps

1. Install `unzip` (required by the Bun installer)
2. Download and run the official Bun install script from `bun.sh/install`; if `PRIVATE_CERTS_FILE` is set, sets `CURL_CA_BUNDLE` so the download succeeds behind corporate TLS inspection
3. If `PRIVATE_CERTS_FILE` is set, append `NODE_EXTRA_CA_CERTS` to `~/.bashrc` so Bun trusts the bundle at runtime

## Verification

```bash
bun --version
```

## Post-install

Run `source ~/.bashrc` or start a new shell to pick up `~/.bun/bin` in your PATH and the `NODE_EXTRA_CA_CERTS` setting.
