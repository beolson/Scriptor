# TUI Library: Recommended Approach

**Decision**: Use `@clack/prompts` for most screens + a custom component built on `@clack/core` for the script list.

---

## Stack

| Screen | Library |
|---|---|
| Fetch / progress | `@clack/prompts` — `spinner()` |
| Script List (multi-select with groups) | Custom — extends `@clack/core` `Prompt<T>` |
| Input Collection (string, number, ssl-cert) | `@clack/prompts` — `text()`, `password()` |
| Confirmation | `@clack/prompts` — `confirm()` |
| Elevation / sudo password | `@clack/prompts` — `password()` |
| Execution output | Raw `process.stdout` — no TUI needed (two-phase architecture is intentional) |

---

## Why @clack instead of Ink

Ink's React/Yoga reconciler imposes ~35–40% overhead that isn't inherent to the problem:

- No built-in list or form components — every navigation cursor and keystroke must be managed manually
- Cannot stream subprocess output while the React tree is active (cursor corruption) — this forced the existing codebase into a two-phase architecture and eliminated real-time execution progress
- Several fragile workarounds in the existing implementation: `setTimeout(150ms)` before exit, ANSI escape for screen clear, `debug: true` in all test renders, a `react-devtools-core` no-op stub for compiled binary compatibility
- Bun stdin bug (#6862): `useInput` callbacks unreliable in non-compiled dev mode

@clack avoids the reconciler entirely — it's imperative, line-by-line output with a thin diff update mechanism. The script list is the only screen complex enough to need custom rendering, and `@clack/core`'s `Prompt` base class provides exactly the right foundation for it.

---

## Script List: Custom Component on @clack/core

The `groupMultiselect` from `@clack/prompts` is insufficient for the script list because it does not support collapsible groups, custom per-item colors, or external dependency auto-selection. Build a custom component by extending `@clack/core`'s `Prompt<T>` base class.

### Architecture

```typescript
import { Prompt } from "@clack/core";

interface ScriptListState {
  // cursor: index into visible rows (including group headers)
  // userSelected: Set<string> — explicitly selected by user
  // autoSelected: Set<string> — auto-selected as transitive dependencies
  // collapsed: Set<string> — collapsed group names
  // error: string | null — inline error message
}

class ScriptListPrompt extends Prompt<string[]> {
  constructor(groups: ScriptGroup[], dependencies: DependencyMap) {
    super({
      render: () => this._render(),
    });
    // set up key handlers: up/down, space, enter, q
  }

  private _render(): string {
    // return the full screen string on each keystroke
    // Prompt base class handles diffing + output
  }
}
```

### Selection state rendering

```
▶ Developer Tools                    ← collapsed group (cursor on group row)
▼ Security                           ← expanded group
  > [x] Configure SSH                ← focused + user-selected (green)
    [~] Setup SSH Keys               ← auto-selected dependency (cyan dim)
    [✓] Configure SSHD   [installed] ← already installed (dim)
    [ ] Configure TLS Endpoint       ← not selected
```

| Marker | Color | Meaning |
|---|---|---|
| `[x]` | green | Explicitly selected by user |
| `[~]` | cyan dim | Auto-selected transitive dependency |
| `[✓]` | dim | Already installed (`creates` path exists) |
| `[ ]` | — | Not selected |
| `>` prefix | blue | Cursor / focused row |
| `[installed]` | dim, right-aligned | Installed badge |

### Dependency auto-selection

Dependency resolution happens inside the prompt on each `Space` keypress — not after the prompt resolves. When the user selects a script, call `resolveDependencies()` immediately and update `autoSelected`. When the user deselects, recalculate the full transitive closure over remaining `userSelected` items.

### Key bindings

| Key | Action |
|---|---|
| `↑` / `↓` | Move cursor |
| `Space` on script | Toggle explicit selection; recalculate auto-deps |
| `Space` on group | Toggle all scripts in group; collapse/expand |
| `Enter` | Validate and submit (requires ≥1 explicit selection) |
| `Q` / `Ctrl+C` | Cancel |

---

## @clack/core Prompt base class

The `Prompt<T>` class from `@clack/core` provides:
- Stdin raw mode management
- Keypress event parsing (`up`, `down`, `space`, `return`, `ctrl+c`, printable chars)
- A `render()` callback called on each keystroke — return the full UI string
- Diff-based output (only rewrites changed lines)
- `submit` / `cancel` lifecycle with `isCancel()` check on the resolved value
- `validate()` callback for blocking submit with an error

```typescript
import { Prompt, isCancel } from "@clack/core";

class MyPrompt extends Prompt<string> {
  constructor() {
    super({
      render() {
        if (this.state === "submit") return "";
        return `> ${this.value ?? ""}`;
      },
    });
  }
}

const p = new MyPrompt();
const result = await p.prompt();
if (isCancel(result)) { /* handle cancel */ }
```

---

## Package install

```
bun add @clack/prompts @clack/core
```

No stubs, no devtools workarounds, no react-devtools-core. Both packages have zero native dependencies and compile cleanly into a Bun standalone binary.

---

## References

- [@clack/prompts source — GitHub](https://github.com/bombshell-dev/clack/tree/main/packages/prompts)
- [@clack/core source — GitHub](https://github.com/bombshell-dev/clack/tree/main/packages/core)
- [GroupMultiSelectPrompt source](https://github.com/bombshell-dev/clack/blob/main/packages/core/src/prompts/group-multiselect.ts)
- [Prompt base class source](https://github.com/bombshell-dev/clack/blob/main/packages/core/src/prompts/prompt.ts)
- [Ink stdin/Bun issue #6862](https://github.com/oven-sh/bun/issues/6862)
- [Ink flickering issue #450](https://github.com/vadimdemedes/ink/issues/450)
