## Overview

Validates that the TUI's sudo credential caching works end-to-end. Runs `sudo whoami` and `sudo id` to confirm cached credentials allow sudo commands to execute without prompting. Does not modify system state.

## Steps

1. Print the step banner
2. Run `sudo whoami` — confirms sudo works without prompting (prints `root`)
3. Run `sudo id` — secondary verification of cached credentials
4. Print Done

## Verification

```bash
# Output should contain "root" from sudo whoami and sudo id.
# No password prompt should appear.
# No "Run as root or use sudo" message should appear.
```
