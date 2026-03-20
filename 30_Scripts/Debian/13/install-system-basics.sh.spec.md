## Overview

Updates system packages and installs essential system utilities (curl, wget) and the ICU development library (libicu-dev) on Debian 13.

## Steps

1. Update apt package lists
2. Upgrade all installed packages
3. Install curl, wget, and libicu-dev via apt-get

## Verification

```bash
curl --version && wget --version && dpkg -s libicu-dev | grep Status
```
