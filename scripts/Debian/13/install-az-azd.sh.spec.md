## Overview

Installs the Azure CLI (`az`) and Azure Developer CLI (`azd`) on Debian 13 using their official install scripts. Optionally configures a private CA bundle for environments that use corporate TLS inspection.

## Steps

1. Install Azure CLI via the official Microsoft Debian installer
2. Install Azure Developer CLI via the official install script
3. If `PRIVATE_CERTS_FILE` is set in the environment, append `AZURE_CLI_DISABLE_CONNECTION_VERIFICATION=1` and `REQUESTS_CA_BUNDLE` exports to `~/.bashrc`

## Verification

```bash
az version
azd version
```

## Post-install

Run `source ~/.bashrc` or start a new shell to pick up the environment variable changes.
