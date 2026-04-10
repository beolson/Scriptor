---
name: scriptor-new-script
description: Creates a new setup script for the Scriptor project — handles platform selection, interactive requirements elicitation, script authoring with best practices, and ShellCheck validation. Use this skill whenever the user wants to add a new script to Scriptor, whether installing software, configuring tools, or automating any system setup task for a specific platform. Triggers on: "add a script", "create a script to install", "write a new scriptor script", "new script for ubuntu/mac/windows", or any request to install or configure something on a specific platform via Scriptor.
---

# Create a New Scriptor Script

## Overview

This skill produces a well-crafted, idempotent setup script for the Scriptor platform, saved to the correct location. The steps:

1. Discover available platforms from `scripts/`
2. Gather platform choice and goal from the user
3. Elicitation loop — clarify until requirements are fully understood
4. Write the script (embedded frontmatter + best practices)
5. Validate with ShellCheck (bash only)
6. Save the file

---

## Step 1: Discover Platforms

Before asking anything, inspect the `scripts/` directory to see what platforms exist:

```bash
ls scripts/linux/ scripts/mac/ scripts/windows/
```

This shows the available `<platform-id>` values (e.g. `ubuntu-24.04-x64`, `macos-sequoia-arm64`, `windows-11-x64`).

---

## Step 2: Gather Platform and Goal

In one message, ask:

1. **Which platform?** Present the discovered options.
2. **What should the script do?** A rough description is fine — you'll clarify in the next step.

---

## Step 3: Elicitation Loop

Don't write the script until you fully understand what it needs to do. This loop surfaces hidden requirements that would otherwise produce a wrong or incomplete script.

### Process

1. Given what you know, identify what's still ambiguous. Think through:
   - Exact tool/package being installed or configured?
   - Specific version, or always latest?
   - Does anything require `sudo` (Linux/Mac) or admin rights (Windows)?
   - Prerequisites — other tools that must exist first?
   - Should the script be idempotent (skip already-done steps)?
   - Platform-specific concerns (e.g. architecture, package manager version)?
   - What does success look like — how would the user verify it worked?

2. Pick the **top 2–3 most important** open questions and ask them as a numbered list. Don't ask everything at once — prioritize the questions that would most change how you write the script.

3. After the user answers, re-evaluate. Are there still meaningful open questions? If yes, ask the next batch. If you can now write a correct, complete script confidently, tell the user and proceed.

### When to stop

You have enough information when you can answer: what tool, what version, what permissions are needed, what prerequisites exist, and what success looks like.

---

## Step 4: Write the Script

### Directory structure and file path

```
scripts/
  linux/
    ubuntu-24.04-x64/
      install-curl.sh
  mac/
    macos-sequoia-arm64/
      install-homebrew.sh
  windows/
    windows-11-x64/
      install-git.ps1
```

**Path formula**: `scripts/<family>/<platform-id>/<script-name>.<ext>`

- **Family**: linux platforms → `linux/`, mac → `mac/`, windows → `windows/`
- **Script name**: kebab-case with an imperative verb prefix: `install-node.sh`, `setup-docker.sh`, `configure-git.sh`
- **Extension**: `.sh` for Linux/Mac, `.ps1` for Windows

### Embedded frontmatter format

Every script carries its own metadata in a comment block at the very top, immediately before the script body. The Scriptor site reads this at build time — no external files needed.

**Bash (`.sh`) — Linux and Mac:**

```bash
#!/usr/bin/env bash
# ---
# platform: <platform-id>
# title: <Title Case Title>
# description: <One-line description.>
# ---
# Opening paragraph in markdown — what this script does and why.
#
# ## What it does
#
# Description of the steps the script takes.
#
# ## Requirements
#
# - Prerequisite one
# - Prerequisite two (use `#` on a line by itself for a blank line in the markdown body)

set -euo pipefail

# script body
```

**PowerShell (`.ps1`) — Windows:**

```powershell
<#
---
platform: <platform-id>
title: <Title Case Title>
description: <One-line description.>
---
Opening paragraph in markdown — what this script does and why.

## What it does

Description of the steps the script takes.

## Requirements

- Prerequisite one
- Prerequisite two
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# script body
```

Required frontmatter fields: `platform`, `title`. `description` is optional but recommended.

### Apply best practices

Read the relevant reference before writing the body:
- **Bash (Linux/Mac)**: `references/bash-best-practices.md`
- **PowerShell (Windows)**: `references/powershell-best-practices.md`

Non-negotiable rules regardless of platform:
- Idempotency — check before acting, don't re-install what exists
- Minimal privilege — `sudo` / admin only on the specific commands that need it
- Strict mode header on every script
- Quote all variables in bash

---

## Step 5: Validate (Bash scripts only)

Run ShellCheck on the script before saving:

```bash
shellcheck scripts/<family>/<platform-id>/<script-name>.sh
```

If ShellCheck isn't installed, see `references/shellcheck.md`.

Fix all issues. Prefer real fixes over `# shellcheck disable` suppression. Re-run until it exits cleanly with no output.

PowerShell: no equivalent tooling available — rely on correct best-practices application from the reference.

---

## Step 6: Save the File and Confirm

Write the validated script to its file path. Then tell the user:

> "Script written to `scripts/<family>/<platform-id>/<script-name>`. The Scriptor site picks it up automatically at the next build — no other changes needed."

Remind the user to run `bun run lint:shell` if they have ShellCheck wired into the project's lint scripts.
