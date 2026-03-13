## Overview

Installs uv, the fast Python package manager from Astral, on Debian 13.
If the `PRIVATE_CERTS_FILE` environment variable is set, configures uv
to use native TLS and sets the custom CA bundle.

## Steps

1. Download and run the official uv installer via wget
2. If `PRIVATE_CERTS_FILE` is set, append `UV_NATIVE_TLS=true` and
   `REQUESTS_CA_BUNDLE` to `~/.bashrc`

## Verification

```bash
source ~/.bashrc
uv --version
```
