## Overview

Installs git and the GitHub CLI (`gh`) on Debian 13 by adding the official GitHub apt repository and installing both packages.

## Steps

1. Install git via `sudo apt-get`
2. Download and install the GitHub CLI GPG keyring
3. Add the GitHub CLI apt repository
4. Update apt and install the `gh` package

## Verification

```bash
git --version
gh --version
```
