# Phase 2 Functional Requirements

## Summary

Build a static marketing and documentation website for Scriptor. The homepage features a copyable install command that detects whether the visitor is on Windows (PowerShell) or another OS (Bash) and surfaces the appropriate command. A scripts listing page displays all available Scriptor scripts; clicking an entry navigates to a detail page that shows the script's full specification. The `scriptor.yaml` format will be extended with a new spec field to support this richer detail view.

## Site Structure

| Route | Page |
|---|---|
| `/` | Home — welcome, install command, platform navigation cards |
| `/scripts/windows` | Windows scripts listing |
| `/scripts/linux` | Linux scripts listing (sub-grouped by distro) |
| `/scripts/mac` | macOS scripts listing |
| `/scripts/[id]` | Script detail page |

## User Stories

- As a developer visiting the homepage, I want to see a ready-to-copy install command for my OS so that I can install Scriptor in one step.
- As a developer on the homepage, I want to see platform cards (Windows, Linux, macOS) and click one to browse scripts for that platform.
- As a developer on a platform listing page, I want to see all scripts for that platform (Linux sub-grouped by distro) and click into a detail view.

## Functional Requirements

- FR-2-001: The scripts listing and detail pages are generated at build time by reading `scriptor.yaml`. Pages are rebuilt whenever `scriptor.yaml` changes (e.g. via CI trigger).
- FR-2-003: The homepage includes: (1) a welcome/hero section, (2) the OS-detected install command with copy button, and (3) three platform navigation cards — Windows, Linux, macOS — each linking to the corresponding platform listing page.
- FR-2-004: Each platform listing page (`/scripts/windows`, `/scripts/linux`, `/scripts/mac`) shows scripts for that platform only. Linux scripts are sub-grouped by distro. Within each group, scripts are sorted alphabetically by name.
- FR-2-005: Each entry on a listing page shows: script name, short description, and arch badge (x86 / arm). Clicking an entry navigates to the script's detail page at `/scripts/[id]`.
- FR-2-006: The script detail page (`/scripts/[id]`) renders the `spec` field as markdown, and also displays: name, description, platform, arch, distro/version (Linux), and dependencies (as a list of script names).
- FR-2-002: The homepage displays an OS-detected install command. Detection is client-side via `navigator.userAgent` or `navigator.platform`:
  - **Windows**: displays a PowerShell command that downloads `scriptor-windows-x64.exe` from GitHub Releases latest to a temp path, then immediately runs it. Example form:
    ```powershell
    $tmp = "$env:TEMP\scriptor.exe"; Invoke-WebRequest -Uri "https://github.com/beolson/Scriptor/releases/latest/download/scriptor-windows-x64.exe" -OutFile $tmp; & $tmp
    ```
  - **All other OS**: displays a Bash command in the form:
    ```
    sudo curl -fsSL "https://github.com/beolson/Scriptor/releases/latest/download/scriptor-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')" -o /usr/local/bin/scriptor && sudo chmod +x /usr/local/bin/scriptor && scriptor
    ```
  - The command is displayed in a code block with a one-click copy button.
  - The binary is downloaded from the GitHub Releases `latest` tag.

## Constraints

- The site must be fully static — no server-side rendering at request time.
- The site is hosted on **GitHub Pages** (repo: `beolson/Scriptor`). The build-and-deploy pipeline runs via GitHub Actions on pushes to the main branch (or whenever `scriptor.yaml` changes).
- Site is built with **Next.js static export** (`next export` / `output: 'export'`). Bun is used as the runtime and package manager.

## scriptor.yaml Schema Extension

A new optional field is added to each script entry:

| Field | Type | Description |
|---|---|---|
| `spec` | string (multi-line markdown) | Long-form description of the script: what it does, why you'd want it, and any prerequisites. Rendered as markdown on the script detail page. |

Example:
```yaml
- id: install-docker
  name: Install Docker
  description: Installs Docker Engine and CLI.
  spec: |
    ## Install Docker

    Installs Docker Engine, the Docker CLI, and the Compose plugin from the
    official Docker apt repository.

    ### Prerequisites
    - Ubuntu 20.04 or later
    - sudo access

    ### What it does
    1. Adds the Docker GPG key and apt repository
    2. Installs `docker-ce`, `docker-ce-cli`, `containerd.io`, and `docker-compose-plugin`
    3. Adds the current user to the `docker` group
  platform: linux
  arch: x86
  distro: ubuntu
  version: "24.04"
  script: scripts/install-docker-ubuntu-x86.sh
```

## Design

- Visual requirements are fully specified in `UX.requirements.md`. Implementation must follow the light-mode color tokens, typography tokens, and component specs defined there.
- The install command block must clearly distinguish itself as a copyable code element.
- The site should be responsive (usable on mobile and desktop).

## Out of Scope

- User authentication or personalization on the website.
- Live/dynamic API calls to GitHub at page-load time (data is baked in at build time).
- Script authoring or editing via the website.
- Search or filtering on the scripts listing pages.
- Custom domain (uses default GitHub Pages URL unless configured separately).

## Open Questions

_(none — requirements sufficiently defined)_
