---
status: Ready
created: 2026-04-05
prd: 001-script-index
---

# Script Index Data Model & Browse — Functional Requirements

## Overview

This epic establishes the script content model (spec file format) and the browseable website that presents scripts filtered by platform, OS, and architecture. Users arrive, narrow down by their environment, select a script, read what it does, and copy a one-liner to run it.

## Use Cases

### UC-001: Browse Scripts by Platform

**Actor:** Developer setting up a new machine
**Trigger:** User arrives at the site
**Preconditions:**
- At least one script exists in the repository

**Main Flow:**
1. The system displays the complete script list (all platforms, all scripts) and all filter dimensions simultaneously: platform, OS/distro, and architecture. Each dimension is rendered as a row of selectable buttons.
2. Filter options that have no matching scripts given the current selection are greyed out and unselectable.
3. The user selects any combination of filters in any order.
4. The script list updates immediately to show only scripts matching all active filters.
5. The user can deselect a filter to broaden results.

**Postconditions:**
- The user sees a list of scripts matching their selected criteria.

**Alternative Flows:**
- If the user clears all filters, the full list of scripts (across all platforms) is shown.

**Error Flows:**
- If no scripts match the selected filters, the system displays an empty-state message (e.g., "No scripts found for this combination").

---

### UC-002: View Script Details

**Actor:** Developer setting up a new machine
**Trigger:** User clicks on a script in the filtered list
**Preconditions:**
- A list of scripts is displayed

**Main Flow:**
1. The system navigates to the script detail page.
2. The system displays the script's name, platform/OS/arch metadata, and the full description from the spec body.
3. The system displays the script source code.
4. The system displays the one-liner run command with a copy button.

**Postconditions:**
- The user has all the information needed to decide whether to run the script.

**Alternative Flows:**
- _None_

**Error Flows:**
- _None_

---

### UC-003: Copy the Run Command

**Actor:** Developer setting up a new machine
**Trigger:** User clicks the copy button on a script detail page
**Preconditions:**
- The user is viewing a script detail page

**Main Flow:**
1. The system copies the one-liner run command to the user's clipboard.
2. The system provides visual feedback confirming the copy was successful.

**Postconditions:**
- The clipboard contains the run command ready to paste into a terminal.

**Alternative Flows:**
- _None_

**Error Flows:**
- _None_

## Acceptance Criteria

- [ ] AC-001: A script spec file (`.md`) co-located with its script source is the sole source of truth — no central manifest file is required.
- [ ] AC-002: The spec frontmatter supports `platform`, `os`, and `arch` fields.
- [ ] AC-003: The site displays a browseable list of scripts filterable by platform, OS, and arch.
- [ ] AC-004: Each entry in the script list shows the script title.
- [ ] AC-005: Selecting a script navigates to a detail page showing the full spec body, script source, and the run command.
- [ ] AC-006: The detail page includes a copy button that copies the one-liner to the clipboard.
- [ ] AC-007: When no scripts match the active filters, the site displays an appropriate empty-state message.
- [ ] AC-008: Filter options that would produce zero results given the current selection are displayed as greyed-out and unselectable.

## Workflows

### Workflow: Discover and Run a Script

1. User arrives at the site.
2. User selects their platform (e.g., Linux).
3. User selects their distro/OS (e.g., Ubuntu 24.04).
4. The script list narrows to matching scripts.
5. User reads script titles, identifies a relevant script.
6. User clicks the script to open the detail page.
7. User reads the full description and reviews the source code.
8. User clicks the copy button to copy the run command.
9. User pastes and runs the command in their terminal.

## Data Requirements

### Script Spec File

Each script has a co-located `.md` spec file with the same base name. The spec file consists of:

- **Frontmatter** (YAML):
  - `platform` — required; one of `linux`, `windows`, `mac`
  - `os` — required; the target OS/distro from a controlled vocabulary (e.g., `ubuntu-24.04`, `windows-11`)
  - `arch` — optional; target architecture (e.g., `x64`, `arm64`); omitting means the script is arch-agnostic
  - `title` — required; human-readable display name for the script

- **Body** (Markdown):
  - The full description of what the script does. The entire body is displayed on the detail page. There is no separate short description — the list view shows only the title.

### Run Command

The one-liner run command format is a `curl | bash` (or `curl | pwsh`) pattern referencing the raw script URL on GitHub. The exact format is to be determined in TechRequirements.

## Edge Cases

- A script spec missing required frontmatter fields should be excluded from the site (not cause a build error).
- A script file with no co-located spec is not displayed on the site.
- Filtering to a platform with no scripts shows the empty-state message.
- Scripts with no `arch` field match any arch filter (or appear when no arch filter is selected).

## Out of Scope

- Full-text search across scripts.
- User contribution workflow (submitting new scripts).
- The Scriptor CLI tool (`tui/` workspace).
- Script input collection, dependency chains, or flow control from the old system.
- Architecture filtering in the v1 browse UI (arch is stored in the spec but the filter UI is deferred).

