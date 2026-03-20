# Research Summary: TUI Library Selection

**Date**: 2026-03-20
**Scope**: Evaluate whether Ink is the right TUI library for the Scriptor rewrite, or whether a simpler alternative should be used.
**Input**: Functional spec + tech spec in `10_Specifications/10.20_Ideas/10.20.001_Tui/`
**Outcome**: Switch to `@clack/prompts` + custom `@clack/core` component for script list.

---

## Context

Scriptor's TUI has these screens:
- **Fetch screen** — spinner + progress during manifest/script download
- **Script list screen** — multi-select with collapsible groups, dependency auto-selection, 4 visual states, installed badges, description below focused item
- **Input collection** — sequential prompts: string, number, ssl-cert (multi-step)
- **Confirmation** — review selected scripts + collected inputs
- **Elevation** — sudo password / Windows admin check
- **Execution** — scripts run outside TUI; raw stdout streams directly to terminal (intentional two-phase design)

The current codebase used Ink + React 19. The rewrite starts from scratch.

---

## Threads Investigated

### Thread 1: Ink deep-dive

**What was asked**: How does Ink work, what are its known pain points, Bun compatibility, what workarounds did the existing Scriptor code need?

**What was found**:

Ink uses React reconciliation → Yoga flexbox layout → ANSI escape codes. Every state update triggers a full component tree traversal and redraw via `log-update`. This is simple but incurs rendering overhead proportional to component tree size.

**Bun compatibility**: Ink's `useInput` is unreliable in Bun dev mode — Bun doesn't call `process.stdin.resume()` automatically (issue #6862). Compiled binaries are more stable but not fully verified across platforms.

**Workarounds found in the existing Scriptor codebase**:
- Two-phase execution: `waitUntilExit()` → Ink unmounts → scripts run in raw process. Reason: subprocess stdout corrupts Ink's cursor tracking. The existing code had an `ExecutionScreen` that was abandoned because of this.
- `setTimeout(150ms)` before calling `exit()` — lets Ink flush one final frame before unmounting
- `process.stdout.write("\x1b[2J\x1b[H")` direct ANSI call for screen clear — Ink has no API for this
- `debug: true` on all `render()` calls — Ink skips stdout in CI environments, breaking tests
- `react-devtools-core` no-op stub — the real package has native deps that cannot be compiled into a Bun binary
- `MAX_OUTPUT_LINES = 8` cap on execution output — prevents rendering overhead from growing lists
- Cursor offset bug caused by `gap={1}` in Box layouts — removed and worked around

**Complexity estimate**: ~35–40% of TUI code is Ink-imposed overhead (manual cursor tracking for lists, manual keystroke-by-keystroke input handling, screen routing boilerplate, async timing hacks). The remaining ~60–65% is inherent problem complexity (manifest parsing, dependency resolution, credential management, platform handling).

---

### Thread 2: Alternative TUI libraries

**What was asked**: What TUI libraries exist for TypeScript/Node/Bun? Can any replace Ink?

**Libraries evaluated**:

| Library | Verdict |
|---|---|
| **@clack/prompts** | Sequential prompts only — cannot do full TUI layout, but handles all non-list screens cleanly |
| **@clack/core** | Headless prompt primitives — `Prompt<T>` base class is the right foundation for custom script list |
| **Enquirer** | 20M weekly downloads, sequential only, no collapsible groups or per-item state |
| **blessed / unblessed** | Full TUI alternative, no React, DOM-like API, requires full rewrite of all components. Bun compat uncertain |
| **terminal-kit** | Too low-level, undermaintained (last release ~1 year ago) |
| **prompts** | Sequential, no group support |
| **Bubbletea (Go)** / **Ratatui (Rust)** | Excellent but require language change — not pursued |
| **Cliffy (Deno)** | Sequential, Deno-first |

**Key finding**: No library in the Node/TypeScript ecosystem provides everything Ink does. The question is whether Ink's overhead is worth it vs. assembling @clack for most screens + a custom list component.

---

### Thread 3: Scriptor codebase complexity analysis

**What was asked**: What percentage of complexity is inherent vs. Ink-imposed? What's the architectural evidence?

**What was found**: The two-phase execution architecture is the smoking gun. Ink cannot safely render while spawned processes write to stdout. The previous codebase had an `ExecutionScreen` that was abandoned. The fix was: TUI exits completely, then scripts run in raw mode.

User confirmed: **two-phase is intentional product design**, not a compromise. Scripts run after the TUI — streaming raw output to the terminal is the right UX.

With two-phase confirmed as intentional, Ink's most damaging limitation is irrelevant. The remaining cost is the 35–40% boilerplate for list navigation, form handling, and screen routing.

---

### Thread 4: @clack/prompts groupMultiselect depth

**What was asked**: Can `@clack/prompts` handle the script list with collapsible groups and multiple selection states?

**What was found**: No. `groupMultiselect` is insufficient:
- Groups are static — no collapse/expand
- Visual states are fixed (green selected, cyan active, dim inactive) — cannot add `[~]` for auto-deps, `[✓]` for installed, right-aligned `[installed]` badge
- Prompt is immutable once running — no external mutation for auto-selecting dependencies mid-interaction
- No per-item description line

`@clack/core`'s `Prompt<T>` base class is the right tool for a custom script list:
- Handles stdin raw mode, keypress parsing, diff output
- Custom `render()` callback called on each keystroke
- `submit`/`cancel` lifecycle, `validate()` hook
- Zero native dependencies, compiles into Bun standalone binary cleanly

---

## Paths Rejected

**Full Ink rewrite**: Ink is viable — actively maintained, React model is familiar. Rejected because:
- Bun stdin reliability on Windows is unverified (#6862)
- 35–40% code overhead for patterns @clack handles out of the box (sequential prompts, spinner, confirm)
- No production gain over @clack + custom list for this specific use case
- The compiled binary workarounds (devtools stub) add fragility

**blessed / unblessed**: Would eliminate Ink's rendering model entirely. Rejected because:
- No React — all components rewritten from scratch to a lower-level DOM-like API
- Bun compat uncertain (bblessed fork exists but not battle-tested)
- Lower-level means more code, not less

**Enquirer for everything**: Rejected because:
- Cannot handle the script list (no collapsible groups, no per-item state, no external mutation)

---

## Decisions Made

1. `@clack/prompts` for all screens except the script list
2. Custom component extending `@clack/core` `Prompt<T>` for the script list
3. Two-phase execution is intentional — execution output goes to raw stdout after TUI exits
4. Windows is a hard requirement — to be verified during implementation

---

## Open Questions (unresolved at close of research)

- **Windows terminal compatibility of @clack**: Not deeply tested on CMD, older PowerShell consoles (pre-ConPTY). @clack uses ANSI escapes — should work in Windows Terminal and modern PowerShell but verify early.
- **Bun compiled binary compatibility of @clack/core**: No reported issues found, but not explicitly verified. Test early with `bun build --compile` on all three platforms.
- **Scroll behavior in custom script list**: @clack/core's `Prompt` handles diff output but doesn't expose a scrolling viewport primitive. The custom list will need to implement a sliding window (like the existing `ScriptListScreen.tsx` approach) if the script list is taller than the terminal.
