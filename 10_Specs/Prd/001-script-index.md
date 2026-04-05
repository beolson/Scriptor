---
status: Ready
created: 2026-04-05
---

# Script Index — Product Requirements

## Vision

A static website that serves as a searchable, browsable index of platform-specific setup scripts. Users discover scripts relevant to their platform (Linux, Windows, macOS), read documentation about what each script does, and run them by copying a small one-liner into their terminal — no CLI tool required.

Each script is self-describing: a spec file (frontmatter + Markdown body) lives alongside the script source and drives both the website display and any build-time processing. There is no central manifest file.

## Goals

- **Fast setup, fewer decisions** — help developers find the right script quickly and get their environment running with minimal friction.
- **Trusted, well-documented scripts** — a curated library where users can understand what a script does before running it.

## User Personas

**Developer setting up a new machine** — someone who frequently provisions dev environments (new laptop, fresh VM, cloud instance) and wants battle-tested scripts they can trust and run immediately, without spending time searching forums or writing setup scripts from scratch.


## High-Level Use Cases

1. **Find scripts for my platform** — a user arrives, filters by platform (Linux, Windows, macOS) and distro/version, browses the resulting list, and identifies scripts relevant to their setup.
2. **Copy the run command** — a user clicks the copy button on a script page to copy a one-liner into their clipboard, then pastes it into their terminal to execute the script.

## Scope Boundaries

**In scope for v1:**
- Browse scripts filtered by platform (Linux, Windows, macOS) and distro/version
- Copy a one-liner run command to the clipboard

**Deferred (not v1):**
- Full-text search across scripts
- Contribution workflow (submitting new scripts)

## Out of Scope

- The existing Scriptor CLI tool (`tui/` workspace) is dropped entirely.
- The central `scriptor.yaml` manifest is replaced by per-script spec files.

## Success Metrics

