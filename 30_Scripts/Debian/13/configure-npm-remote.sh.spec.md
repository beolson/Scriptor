## Overview

Configures bun and npm to use a custom npm registry on Debian 13 by writing to `~/.npmrc`. Designed for GitHub Packages (`https://npm.pkg.github.com`) but works with any npm-compatible registry (Verdaccio, Nexus, Artifactory, etc.). Supports optional auth tokens (GitHub PAT with `read:packages` scope) and scoped registry pinning. The script is idempotent — re-running it with the same or updated values safely replaces prior configuration.

## Steps

1. Validate that a registry URL was provided
2. Extract the registry hostname from the URL for the auth token line
3. If no auth token was provided and `gh` CLI is installed and authenticated, retrieve the token via `gh auth token`
4. Remove any pre-existing entries for the same registry/scope from `~/.npmrc` (idempotency)
5. Write the registry line — scoped (`@org:registry=<URL>`) if a scope is provided, global (`registry=<URL>`) otherwise
6. If an auth token is available, write `//<host>/:_authToken=<TOKEN>` to `~/.npmrc`

## Verification

```bash
# Confirm registry entry was written
cat ~/.npmrc

# Test bun can resolve packages from the registry (replace @scope/pkg as appropriate)
bun add @scope/some-package --dry-run
```

## Inputs

- **Registry URL** (required): base URL of the custom registry (e.g. `https://npm.pkg.github.com`).
- **Auth token** (optional): for GitHub Packages, a classic PAT with at minimum `read:packages` scope. If left blank and `gh` CLI is installed and authenticated, the token is retrieved automatically via `gh auth token`.
- **Scope** (optional): limits the custom registry to one npm scope (e.g. `@myorg`). If omitted, the registry becomes the global default.
