## Overview

Installs Oh My Bash, a community-driven framework for managing Bash configuration,
on Debian 13. Sets the shell theme to agnoster.

## Steps

1. Download and run the official Oh My Bash installer via wget
2. Update `~/.bashrc` to set `OSH_THEME` to `agnoster`

## Verification

```bash
echo "$OSH"
bash -i -c 'echo $OSH_THEME'
```
