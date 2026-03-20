## Overview

Configures global git identity on Debian 13 by setting `user.name` and `user.email` in `~/.gitconfig`.

## Steps

1. Run `git config --global user.name "<name>"`
2. Run `git config --global user.email "<email>"`
3. Print the configured values for confirmation

## Verification

```bash
git config --global user.name
git config --global user.email
```

## Inputs

- **Full name** (required): displayed in git commit metadata (e.g. `Jane Smith`).
- **Email address** (required): associated with git commits (e.g. `jane@example.com`).
