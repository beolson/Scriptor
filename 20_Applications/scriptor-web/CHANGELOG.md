# @scriptor/scriptor-web

## 0.3.5

### Patch Changes

- d146596: fix: fetch go SHA256 from dl.google.com instead of go.dev to avoid HTML redirect

## 0.3.4

### Patch Changes

- 4676962: fix: redirect interactive reads to /dev/tty so install-custom-certificate.sh works via curl | bash

## 0.3.3

### Patch Changes

- 785d3d0: Fix install-custom-certificate.sh crashing with "awk: cannot open chain.pem" behind SSL inspection proxies

## 0.3.2

### Patch Changes

- b5ab49f: Fix SHA256 verification in install-go.sh failing due to CRLF line endings

## 0.3.1

### Patch Changes

- 3f73d9b: Standardize sudo handling and curl auto-install in debian-13-x64 scripts

## 0.3.0

### Minor Changes

- d34df8a: Add script groups, version display, and per-platform install commands

## 0.2.5

### Patch Changes

- 3b31816: Split WSL setup into two scripts and fix Debian 13 user creation

## 0.2.4

### Patch Changes

- 5f361a8: Consolidate Windows install scripts into one and make WSL distro name interactive

## 0.2.3

### Patch Changes

- 55424ee: Fix release workflow to run E2E against a fixture build before building for deploy

## 0.2.2

### Patch Changes

- 778a00e: Fix release workflow E2E step to use fixture scripts directory

## 0.2.1

### Patch Changes

- fb20798: Add Windows 11 scripts: WSL Debian 13 setup and dev app installer (Windows Terminal, VS Code, Chrome)

## 0.2.0

### Minor Changes

- 518415e: Add Debian 13 (Trixie) x64 platform with 14 setup scripts covering GPU drivers, container runtimes (Docker/Podman/minikube), dev tools (Go, Bun, uv, .NET, Azure CLI, GitHub CLI), SSH hardening, and system configuration.
