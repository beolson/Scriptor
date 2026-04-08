---
status: Ready
created: 2026-04-07
prd: 001-script-index
---

# Web Refresh and Script Browse — Functional Requirements

## Overview

This epic delivers two things: a visual refresh of the website design and a fix to how script filtering works on the browse page.

The current design was built around a Scriptor CLI/TUI tool that users would install and run. That tool has been dropped. The website is now the primary surface: users discover scripts by browsing, read what each script does on its detail page, and copy a one-liner command to run that script directly — no installed tool required. The design refresh updates all affected screens to reflect this reality.

The current filter UI shows OS options only after a platform is selected, making filters sequential and hidden. The new filter is a single flat list of targets, where each option fully identifies both platform and architecture in one label — for example, "Debian 13 X64", "Debian 13 ARM", "Windows 11 X64", "macOS Tahoe ARM". The available target options are derived at build time from the scripts present in the repository; only targets that have at least one script appear as filter options.

The script manifest is also simplified: each script declares exactly one combined target identifier (e.g., `platform: debian-13-x64`) rather than separate OS, version, and architecture fields.

## Use Cases

### UC-001: Browse Scripts with a Single Target Filter

**Actor:** Developer setting up a new machine
**Trigger:** User arrives at the scripts browse page
**Preconditions:**
- At least one script exists in the repository

**Main Flow:**
1. The system displays a flat list of target filter options — one per available target (e.g., "Debian 13 X64", "Debian 13 ARM", "Windows 11 X64", "macOS Tahoe ARM"). Only targets that have at least one script appear.
2. The user selects a target filter option.
3. The script list updates immediately to show only scripts for the selected target.
4. The user may select a different target to switch to that target's scripts.
5. The user may deselect the active target to return to the unfiltered list.

**Postconditions:**
- The script list reflects the active filter selection.
- Every filter option shown has at least one matching script.

**Alternative Flows:**
- If no filter is selected, all scripts across all targets are shown.

**Error Flows:**
- _None_ — because only targets with scripts are shown as options, a selection always returns at least one result.

---

### UC-002: Understand Scriptor on the Homepage

**Actor:** First-time visitor
**Trigger:** User arrives at the Scriptor homepage
**Preconditions:**
- The homepage is loaded

**Main Flow:**
1. The system displays a brief explanation of what Scriptor is: a curated library of setup scripts for configuring machines.
2. The system displays a prominent call-to-action to browse the script library.
3. The user clicks the browse CTA.
4. The system navigates to the scripts browse page.

**Postconditions:**
- The user understands Scriptor's purpose and has a clear path to explore scripts.

**Alternative Flows:**
- _None_

**Error Flows:**
- _None_

---

### UC-003: View Script Detail and Copy Run Command

**Actor:** Developer setting up a new machine
**Trigger:** User clicks a script in the browse list
**Preconditions:**
- A list of scripts is displayed

**Main Flow:**
1. The system navigates to the script's detail page.
2. The system displays the script's title, target (e.g., "Debian 13 X64"), and the full description from the spec body.
3. The system displays the script source code.
4. The system displays a one-liner run command the user can paste into their terminal, with a copy button. The command is a raw GitHub URL piped to a shell interpreter, e.g.:
   ```
   curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/debian-13-x64/neovim.sh | bash
   ```
5. The user clicks the copy button.
6. The system copies the one-liner command to the clipboard and shows visual confirmation.

**Postconditions:**
- The clipboard contains the run command, ready to paste into a terminal.

**Alternative Flows:**
- _None_

**Error Flows:**
- _None_

**Notes:**
- Each script is written for exactly one target. The script detail page corresponds to that single target. The run command on this page only works on the specific environment the script targets.

## Acceptance Criteria

- [ ] AC-001: The browse page displays a single flat list of target filter options. Each option is a combined label expressing OS, version, and architecture in one (e.g., "Debian 13 X64", "macOS Tahoe ARM"). There is no separate OS tier, version tier, or architecture tier.
- [ ] AC-002: Target filter options are derived at build time from the scripts present in the repository. Only targets that have at least one script appear as filter options. No target labels are hardcoded.
- [ ] AC-003: Selecting a target filter option immediately narrows the script list to scripts for that target.
- [ ] AC-004: Deselecting the active filter immediately restores the full unfiltered script list.
- [ ] AC-005: The script list updates immediately when any filter selection changes — no page reload is required.
- [ ] AC-006: The homepage hero section displays a brief explanation of what Scriptor is (a curated library of setup scripts) and does not reference or promote a CLI/TUI install command.
- [ ] AC-007: The homepage hero section displays a prominent call-to-action that navigates to the scripts browse page.
- [ ] AC-008: The script detail page displays a one-liner run command in the form `curl -fsSL <raw-github-url> | bash` (or equivalent shell interpreter for the platform), together with a copy button.
- [ ] AC-009: Clicking the copy button copies the run command to the clipboard and shows visual confirmation.
- [ ] AC-010: The run command on the detail page is specific to the exact target of that script. No generic or multi-target command is shown.
- [ ] AC-011: Each script in the manifest declares exactly one combined target identifier (e.g., `platform: debian-13-x64`) rather than separate OS, version, and architecture fields.
- [ ] AC-012: The script directory structure reflects the combined target identifier (e.g., `scripts/linux/debian-13-x64/`).

## Workflows

### Workflow: Discover and Run a Script

1. User arrives at the browse page; all available target filter options are shown as a flat list.
2. User selects "Debian 13 ARM" from the target list.
3. The script list immediately narrows to scripts targeting Debian 13 ARM.
4. User clicks a script to open its detail page.
5. User reads the description and reviews the source code.
6. User clicks the copy button to copy the run command.
7. User pastes and runs the command in their terminal.

## Data Requirements

The script manifest simplifies to a single combined target field per script:

```
platform: debian-13-x64
```

The run command is derived at build time from the script's known path in the repository:

```
curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/<platform>/<target>/<script-name>.sh | bash
```

The Script type (title, target, description, source, runCommand) is sufficient. The target field replaces the separate os, version, and arch fields used previously.

## Edge Cases

- If a script does not declare a target, it is excluded from the filter and the browse list.
- If all scripts for a target are removed from the repository, that target option no longer appears in the filter at the next build.

## Design Fidelity

The implementation should be **faithful but flexible** relative to Variant1.pen: match the overall visual language (color palette, typography, component shapes, layout structure) but minor deviations in spacing or proportions do not require explicit sign-off. Visual details for empty-state presentation are implementation decisions to be resolved during development using Variant1.pen as the primary reference.

## Out of Scope

- Full-text search across scripts.
- User contribution workflow.
- Mobile-specific filter layout (deferred).
- Script dependency display in the UI (e.g., "Script A requires Script B") — deferred to a future epic.
- Multiple simultaneous target filter selections (single selection only in this epic).
