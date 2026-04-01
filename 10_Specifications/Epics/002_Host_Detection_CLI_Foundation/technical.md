# Technical Standards — 002 Host Detection & CLI Foundation

## Runtime & Language

All standards from Epic 001 apply. Key constraints repeated for reference:

- **Runtime**: Bun only. Never use Node, npm, npx, or yarn.
- **Language**: TypeScript 5, strict mode.
- **Imports**: `.js` extensions on all relative imports (bundler-mode resolution).

## Key Libraries & Frameworks

No new dependencies are introduced in this epic. All required packages are already in `20_Applications/tui/package.json`:

- **`commander` ^14.0.3** — CLI flag parsing (`--repo`, `--apply-update`)
- **`@clack/prompts` ^0.10.0** — `log.error()` for TTY guard and error reporting

## APIs & External Services

- **`process.platform`** — detects OS (`"linux"`, `"darwin"`, `"win32"`)
- **`process.arch`** — detects CPU architecture (`"x64"`, `"arm64"`, `"arm"`, etc.)
- **`process.stdin.isTTY`** — TTY check (boolean or `undefined` when not a TTY)
- **`Bun.file(path).text()`** — reads `/etc/os-release`; wrapped in try/catch for missing-file case
- **`Bun.spawnSync(["git", "rev-parse", "--show-toplevel"])`** — synchronous git root check for `--repo=local`
- **`process.exit(code)`** — used directly for exit code 1 conditions

## Architecture Patterns

### Injectable Deps (detectHost.ts)

`detectHost` accepts an optional `deps` argument so tests can supply mock values without touching the filesystem or process globals:

```ts
type DetectHostDeps = {
  platform?: string;
  arch?: string;
  readFile?: (path: string) => Promise<string>;
};

export async function detectHost(deps: DetectHostDeps = {}): Promise<HostInfo>
```

Production callers pass no arguments. Tests inject `{ platform: "linux", readFile: async () => "NAME=Ubuntu\nVERSION_ID=22.04" }`.

### CLI Entrypoint Structure

`src/index.ts` uses `program.parse(process.argv)` (synchronous) followed by an immediately-invoked async function (IIFE) that runs the orchestrator. No `.parseAsync()`.

```ts
program.option("--repo <repo>", ...).parse(process.argv);
const opts = program.opts();

(async () => {
  // TTY guard
  // orchestrator sequence
})().catch((err) => { log.error(...); process.exit(1); });
```

### Orchestrator Stubs

`src/index.ts` defines named async stub functions for each downstream phase. Each stub is called in sequence and throws `"not implemented"` until replaced by a later epic:

```ts
async function runStartup(...) { throw new Error("not implemented") }
async function runScriptSelection(...) { throw new Error("not implemented") }
// etc.
```

The orchestrator wraps all phase calls in a top-level try/catch that calls `log.error()` and `process.exit(1)` on any unhandled error.

## Constraints & Non-Goals

- No new npm/bun packages are added in this epic.
- `detectHost` must be fully unit-testable without a real filesystem or platform.
- The orchestrator stubs are intentionally minimal — no types or return values are defined until the implementing epic needs them.
- `--apply-update` handler is a stub only; no self-update logic in this epic.
- Config file access is out of scope; default repo (`beolson/Scriptor`) is a hardcoded fallback.
