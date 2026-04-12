---
status: Ready
created: 2026-04-11
prd: 001-script-index
---

# Script Groups and Version Display — Functional Requirements

## Overview

This epic delivers two things: script groups and a version display in the site footer.

**Script groups** let scripts be bundled into named collections — for example, "Setup Linux Dev" might include Bun, Go, .NET, and GitHub CLI setup scripts. Groups appear on the browse page as distinct, browsable entries alongside individual scripts. A user can run the entire group in one shot or step through individual scripts in the group. When run as a group, the shell-side runner downloads and executes each member script in order, with a visual progress indicator showing which script is currently running ("Running script 2 of 4: Installing Go").

**Version display** adds the current Scriptor version number to the site footer. This is a small, self-contained addition included here for delivery efficiency — it does not share any implementation with script groups.

## Scope Decision

These two capabilities were initially described together by the product owner. The version display is estimated at roughly one story point; script groups is the primary investment of this epic. Both are included here. If scheduling requires it, version display can be extracted to its own micro-epic without any rework.

## Use Cases

### UC-001: Browse Script Groups

**Actor:** Developer setting up a new machine
**Trigger:** User arrives at the scripts browse page
**Preconditions:**
- At least one group or individual script exists in the repository

**Main Flow:**
1. The browse page displays a single unified list. Group entries appear first; ungrouped individual scripts appear after all group entries in a visually distinct block at the bottom (no explicit section label is required, but there is clear visual separation between the groups section and the ungrouped scripts section).
2. Each group entry is visually distinguished from ungrouped script entries by a badge, icon, or tag indicator. An expand control is also visible on each group entry.
3. The user expands a group entry inline to reveal a nested list of its member scripts. Each member is shown as a clickable link (script title) with its one-line description displayed beneath the title.
4. The user can click any member script link from the expanded list to navigate to that script's detail page.
5. Alternatively, the user clicks the group entry itself (rather than the expand control) to navigate to the group's detail page.
6. Ungrouped individual scripts in the bottom section each link directly to their individual detail pages.

**Postconditions:**
- The user can see all available groups and ungrouped scripts in one place.
- The user can visually distinguish group entries from individual script entries at a glance.
- The user can inspect what a group contains without leaving the browse page.
- The user can navigate to either a group detail page or an individual script page from the browse list.

**Alternative Flows:**
- If the browse page has an active platform filter, only groups whose member scripts all belong to that platform are shown. Because all members of a valid group must share the same platform (see Data Requirements), a platform filter maps cleanly to an all-or-nothing group match — either the whole group belongs to that platform or it does not appear.

**Error Flows:**
- A group whose member scripts are all missing or invalid is hidden from the browse page.

---

### UC-002: View Group Detail Page

**Actor:** Developer setting up a new machine
**Trigger:** User clicks a group entry (not the expand control) on the browse page, or navigates directly to a group URL
**Preconditions:**
- The group has at least one valid member script

**Main Flow:**
1. The system displays the group detail page.
2. The page layout mirrors the individual script detail page: group title, description, platform information, and a copyable one-liner command.
3. The one-liner command runs the entire group when executed in a shell.
4. Below the one-liner, the page lists all member scripts in declared order.
5. Each member script entry is a clickable link navigating to that script's individual detail page.

**Postconditions:**
- The user can copy the group one-liner or navigate to any individual member script.

**Alternative Flows:**
- None.

**Error Flows:**
- A group with no resolvable member scripts renders an empty member list with a notice; the one-liner is still present if the group runner URL can be constructed.

---

### UC-003: Run a Script Group

**Actor:** Developer setting up a new machine
**Trigger:** User chooses to run a group from the group detail page
**Preconditions:**
- The user is viewing a group detail page
- The user has a shell open on a supported platform

**Main Flow:**
1. The detail page shows a one-liner command the user can copy (similar to individual scripts).
2. The user copies the command and runs it in their shell.
3. The runner script downloads itself and begins executing member scripts in declared order.
4. Before each member script runs, the runner prints a progress indicator: e.g., `[2/4] Installing Go...`
5. Each member script is downloaded from its canonical URL and executed.
6. After all scripts complete, the runner prints a summary.

**Postconditions:**
- All member scripts have been executed in order.
- The user received visible progress feedback throughout.

**Alternative Flows:**
- The user may also copy and run individual member scripts from the group detail page.

**Error Flows:**
- If a member script fails, the runner stops immediately and reports which script failed and what error occurred.
- The runner does not continue to subsequent scripts after a failure (fail-fast, no override flag).

---

### UC-004: Display Site Version in Footer

**Actor:** Any site visitor
**Trigger:** Any page load
**Preconditions:**
- The site has been built with a version number available

**Main Flow:**
1. The site footer displays the current Scriptor version (e.g., `v1.4.0`).
2. The version number is resolved at build time from `20_Applications/scriptor-web/package.json`.

**Postconditions:**
- The version is visible on every page.

**Alternative Flows:**
- None.

**Error Flows:**
- If the version cannot be resolved at build time, the footer omits the version field rather than displaying a placeholder or crashing the build.

---

## Acceptance Criteria

- [ ] AC-001: The browse page displays a single unified list: group entries appear first, followed by ungrouped individual script entries in a visually distinct block at the bottom.
- [ ] AC-002: Ungrouped scripts are visually separated from group entries — no explicit label is required, but there is a clear visual boundary between the two sections.
- [ ] AC-003: Each group entry carries a visual indicator (badge, icon, or tag) that distinguishes it from ungrouped script entries.
- [ ] AC-004: Each group entry on the browse page has an inline expand control that reveals the group's member scripts as a nested list — each member shown as a clickable link (script title) with its one-line description beneath it.
- [ ] AC-005: Clicking a group entry (not the expand control) navigates to the group detail page.
- [ ] AC-006: Each group has a detail page that shows the group title, description, platform information, and a copyable one-liner command.
- [ ] AC-007: The group detail page lists all member scripts in declared order as clickable links to their individual detail pages.
- [ ] AC-008: The group detail page layout is visually consistent with individual script detail pages.
- [ ] AC-009: A group one-liner command is copyable from the group detail page.
- [ ] AC-010: Running the group one-liner executes all member scripts in order.
- [ ] AC-011: The runner prints a per-script progress indicator before each script runs.
- [ ] AC-012: If a member script fails, the runner halts and reports the failure.
- [ ] AC-013: Individual member scripts remain independently runnable.
- [ ] AC-014: The build generates a runner script (`run-all.sh` or `run-all.ps1`) for each group and commits it to the repository at `scripts/<platform>/<group-name>/`.
- [ ] AC-015: The generated runner hard-codes the ordered member script raw GitHub URLs; updating group membership requires regenerating and re-committing the runner.
- [ ] AC-016: The site footer displays the package version on every page.
- [ ] AC-017: A missing or unresolvable version omits the footer version field gracefully — no build failure.

## Workflows

### Group Authoring Workflow

A developer creates a group by:
1. Adding an entry for the new group (ID, name, description) to the groups manifest file.
2. Adding `group: <group-id>` and `group_order: <integer>` to the frontmatter of each member script.

The web build scans all scripts, discovers group membership from frontmatter, looks up display metadata from the manifest, and assembles the group automatically — no other code changes needed.

### Group Execution Workflow

A dedicated runner script is generated at build time for each group and committed to the repository. The runner lives alongside the group's member scripts at `scripts/<platform>/<group-name>/run-all.sh` (Linux/macOS) or `scripts/<platform>/<group-name>/run-all.ps1` (Windows). Because it is committed, it is accessible at a stable raw GitHub URL (e.g., `https://raw.githubusercontent.com/<org>/<repo>/main/scripts/<platform>/<group-name>/run-all.sh`).

The group detail page's one-liner `curl`s (or `irm`/`iex` on PowerShell) this hosted runner directly. The runner script itself contains the list of member script URLs hard-coded inside it and:
1. Iterates over the ordered member list.
2. Downloads each member script from its canonical raw URL.
3. Executes each script, printing progress before execution (e.g., `[2/4] Installing Go...`).
4. Stops on first failure.

## Data Requirements

- **Group membership via script frontmatter**: Individual scripts opt into a group by adding two optional fields to their embedded frontmatter:
  - `group` — a group ID string (e.g., `linux-dev-setup`). A script may belong to at most one group.
  - `group_order` — an integer that controls the script's position within the group. Lower values run first.
- **Groups manifest file**: `scripts/groups.json` — colocated with the scripts it describes at the root of the `scripts/` tree. It lists all valid group IDs with a human-readable name and a short description for each. This file is the source of truth for group metadata displayed on the web site.
- **Platform constraint**: All scripts in a group must share the same platform/os/arch. A group is implicitly scoped to the platform of its member scripts; the manifest file does not need to declare the platform separately because it can be inferred and validated from member script frontmatter.
- **Member script reference**: Members are discovered at build time by scanning all scripts for a matching `group` frontmatter field. The manifest provides metadata; the scripts themselves declare membership.
- **Generated runner script**: For each group, the build generates a runner script committed to the repository at `scripts/<platform>/<group-name>/run-all.sh` (Linux/macOS) or `scripts/<platform>/<group-name>/run-all.ps1` (Windows). The runner hard-codes the ordered list of member script raw GitHub URLs and is itself hosted at a raw GitHub URL. The group detail page one-liner fetches and executes this runner.
- **Version number**: Read from `20_Applications/scriptor-web/package.json` at build time and injected as a build-time constant.

## Edge Cases

- A group ID in a script's frontmatter does not match any entry in the groups manifest — the script is treated as ungrouped (or the build warns and skips the group).
- A group contains only one member script.
- A script declares a `group` but omits `group_order` — the script is sorted after all scripts that declare an explicit order, with filename as the tiebreaker among unordered scripts.
- Two scripts in the same group declare the same `group_order` value — filename is used as a secondary sort key to produce a stable, deterministic order.
- A group's member scripts span multiple platforms/os/arch combinations — this is invalid; the build must surface an error.
- The version field is missing from `20_Applications/scriptor-web/package.json`.

## Out of Scope

- GUI-based group creation or editing.
- Partial execution (running a subset of group members) from the UI — users can always copy individual script one-liners.
- Group nesting (groups of groups).
- Authentication or gating on script download.
- Resume-after-failure or `--continue-on-error` behavior — the runner is strictly fail-fast for v1.
