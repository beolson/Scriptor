# 006 TUI Startup & Selection Screens

## Summary

This epic implements the interactive script selection experience — the visible front-end of Scriptor's startup sequence. It covers the startup orchestrator (which sequences GitHub fetch, manifest parse, and host filtering while driving the Clack UI directly), the fetch screen (spinner, cache-hit update prompt, error states), and the script selection screens (main menu with group mode and individual mode, installed-status detection).

This epic is the first one a user sees after launching Scriptor. It wires together the previously-built data layers (Epic 4 — cache/GitHub, Epic 5 — dependency resolution) into a complete, interactive flow that ends with an ordered list of scripts ready for execution.

---

## Business Value

- **Primary developer experience touchpoint.** Every Scriptor session begins here. A polished, fast startup makes the tool feel trustworthy and reduces friction for machine setup.
- **Host-aware filtering** means users are never shown scripts irrelevant to their machine — no noise, no confusion.
- **Group mode** reduces cognitive load: developers setting up a new machine can pick a curated bundle with one keypress rather than hunting through a long list.
- **Installed-status labeling** prevents re-running setup steps that are already complete, saving time and avoiding accidental re-configuration.

---

## User Stories

1. **As a developer setting up a new machine**, I want to launch Scriptor and see a list of relevant script groups so I can quickly queue a whole bundle without selecting each script individually.

2. **As a developer who only needs specific tools**, I want to select "Individual scripts" from the main menu and multi-pick from the filtered list so I have fine-grained control over what runs.

3. **As a returning user**, I want already-installed scripts to be visually marked so I can skip them or be aware they are already present.

4. **As a developer testing against a local manifest**, I want the fetch screen to show a spinner while the manifest is being downloaded and to prompt me about updates when a cached copy is already present.

5. **As a developer on an unsupported platform**, I want a clear warning when no scripts match my host so I know why nothing appeared.

---

## Acceptance Criteria

### Startup Orchestrator (`src/startup/`)

- The orchestrator calls the cache/GitHub layer (Epic 4) to fetch the raw manifest YAML, then calls the manifest parser (Epic 3), then calls the host filter (Epic 3).
- The orchestrator drives the Clack UI directly (no event-bus decoupling). Typed `StartupEvent`-style return values may be used internally for clarity but no pub/sub architecture is required.
- On network failure: if a cached copy exists, the cache layer (Epic 4) falls back to it transparently. If no cache exists, the orchestrator logs an error and exits 1.
- On manifest parse failure (invalid YAML) or schema validation failure: log all errors and exit 1. No retry offered.

### Fetch Screen (`src/tui/fetch.ts`)

- A spinner is shown while the manifest is being fetched.
- On a **cache hit**, the user is prompted: "Check for updates?" before the fetch proceeds. If the user declines, the cached manifest is used immediately (no spinner).
- On a **cache miss**, the fetch proceeds immediately without a prompt.
- Spinner stops on success or error before displaying any subsequent UI.

### Script Selection Screen (`src/tui/scriptList.ts`)

**Main menu:**
- Lists groups in manifest order, filtered to groups with at least one host-matching script. Groups are shown regardless of whether their host-matching scripts are already installed.
- After all groups, shows "Individual scripts" and "Settings" options.
- "Settings" displays a placeholder message ("Settings coming soon.") and returns the user to the main menu.

**No scripts match host:**
- If the filtered manifest is empty after host-matching, display a warning message and exit 0.

**Group mode:**
- Selecting a group adds all non-installed member scripts to the candidate set and proceeds to dependency resolution (Epic 5).
- If all member scripts are already installed, the candidate set is empty; the flow proceeds normally (empty execution plan is handled downstream).

**Individual mode:**
- Pressing Escape on the multi-select list returns the user to the main menu (not exit).
- Each entry shows script name and description.
- Already-installed scripts are labeled `[installed]` with the `creates` path as a hint.
- Submitting with zero scripts selected proceeds with an empty candidate set (no validation error).
- Submitting with one or more scripts selected proceeds to dependency resolution (Epic 5).

**Installed status:**
- A script is "installed" if its `creates` field is defined and the resolved path exists on disk.
- The `~` prefix in `creates` is expanded to the user's home directory before the check.
- Scripts without a `creates` field are never marked as installed.

**Cancellation:**
- Pressing Escape or Ctrl+C at any prompt (except individual mode list — see above) exits with code 0.

---

## Constraints

- **Error handling**: On fetch failure (no fallback cache), manifest parse failure (invalid YAML), or schema validation failure, log the error and exit 1. No retry is offered.
- **All-installed group**: When a group is selected and every member script is already installed, proceed to the confirmation screen with an empty execution plan (no special message or early return).
- **Individual mode back navigation**: Pressing Escape from the individual multi-select list returns the user to the main menu (not exit).
- **Empty individual selection**: Submitting with zero scripts selected proceeds to the confirmation screen with an empty execution plan.
- **Installed group visibility**: Groups are shown in the menu if they have at least one host-matching script, regardless of whether those scripts are already installed.
- **No scripts match host**: Display a warning message (e.g., "No scripts available for this host") and exit 0.
- **Orchestrator UI coupling**: The startup orchestrator calls Clack directly — no event-bus or listener pattern.
- **Dependencies**: This epic depends on Epic 3 (manifest parse + filter), Epic 4 (cache/GitHub client), and Epic 5 (dependency resolution). All three must be complete before this epic can be integrated end-to-end.

---

## Out of Scope

- **Dependency resolution logic** — handled by Epic 5. This epic only assembles the initial candidate set and passes it downstream.
- **`run_if` filtering** — part of Epic 5's Phase 0 filter pass.
- **Input collection** — Epic 7.
- **Execution plan confirmation** — Epic 8.
- **Settings screen implementation** — placeholder only in this epic.
- **"Back" navigation from group selection** — once a group is selected, the flow proceeds forward; only the individual multi-select list has an Escape-to-menu behavior.

---

## Open Questions

_(None remaining.)_
