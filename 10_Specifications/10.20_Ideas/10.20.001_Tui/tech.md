# Scriptor TUI — Technical Specification (As-Built)

> Documents implementation details, platform-specific hacks, Ink/React quirks, and architectural patterns.
> Primary source: source code read-back by automated analysis (March 2026).

---

## Table of Contents

1. [Build System](#1-build-system)
2. [Module Resolution & .js Extensions](#2-module-resolution--js-extensions)
3. [The stubs/ Directory](#3-the-stubs-directory)
4. [TypeScript Configuration](#4-typescript-configuration)
5. [Linting & Formatting (Biome)](#5-linting--formatting-biome)
6. [Turbo Pipeline](#6-turbo-pipeline)
7. [Dependency Injection Pattern](#7-dependency-injection-pattern)
8. [Windows-Specific Implementation](#8-windows-specific-implementation)
9. [TTY Detection & Guarding](#9-tty-detection--guarding)
10. [Process Spawning](#10-process-spawning)
11. [PowerShell UTF-8 Hack](#11-powershell-utf-8-hack)
12. [Ink & React Rendering](#12-ink--react-rendering)
13. [Key Input Handling](#13-key-input-handling)
14. [useStdout & Output Management](#14-usestdout--output-management)
15. [Async Patterns & Race Conditions](#15-async-patterns--race-conditions)
16. [State Management](#16-state-management)
17. [Output Streaming Into Ink](#17-output-streaming-into-ink)
18. [Screen Clearing](#18-screen-clearing)
19. [Two-Phase Execution Architecture](#19-two-phase-execution-architecture)
20. [Sudo Keepalive Mechanism](#20-sudo-keepalive-mechanism)
21. [OAuth Token Polling](#21-oauth-token-polling)
22. [Binary Self-Update (Windows Limitation)](#22-binary-self-update-windows-limitation)
23. [Testing Infrastructure](#23-testing-infrastructure)
24. [Bun-Specific APIs](#24-bun-specific-apis)

---

## 1. Build System

**Command** (`tui/package.json`):
```json
"build": "bun build src/index.ts --compile --outfile ../dist/scriptor"
```

**`--compile` flag**: Produces a standalone binary that embeds the Bun runtime, all Node.js API shims, and all bundled TypeScript source. The resulting binary has zero external runtime dependencies — no Bun or Node.js installation required on target machines.

**Platform targeting**: There are no platform-specific build flags. The same command runs on each CI runner (linux-x64, linux-arm64, darwin-x64, darwin-arm64, windows-x64, windows-arm64), producing a native binary for that platform. The release workflow uploads 6 artifacts to GitHub Releases.

**Output**: `dist/scriptor` (or `dist/scriptor.exe` on Windows — Bun adds the extension automatically).

**Self-update guard**: The binary detects whether it is running as a compiled binary via:
```typescript
const isBinary = path.basename(process.execPath).startsWith("scriptor");
```
If not a binary (i.e., `bun run` in dev), self-update is disabled.

**Why `--compile` specifically**:
- Scripts are fetched and run on user machines that may not have any JS runtime
- Single file distribution matches the project's "download and run" model
- No install step; works alongside shell-bootstrapped environments

---

## 2. Module Resolution & .js Extensions

All relative imports in the TUI source use explicit `.js` extensions on `.ts` files:

```typescript
// Correct:
import { detectHost } from "./detectHost.js";
import { parseManifest } from "../manifest/parseManifest.js";

// Wrong (will fail):
import { detectHost } from "./detectHost";
```

**Root cause**: `tsconfig.json` sets `"moduleResolution": "bundler"` and `"verbatimModuleSyntax": true`.

- `bundler` mode resolves imports the way esbuild/Bun/webpack do: explicit `.js` extensions are expected even when importing `.ts` source files
- `verbatimModuleSyntax` prevents TypeScript from rewriting import paths; whatever is in the source is preserved verbatim in the output
- Bun resolves `.js` → `.ts` at bundle time, so `.js` extensions in source correctly map to `.ts` files

This is **not a stylistic choice** — removing the `.js` extension breaks the bundler.

---

## 3. The stubs/ Directory

**Location**: `tui/stubs/react-devtools-core/`

**Contents**:
```javascript
// stubs/react-devtools-core/index.js
export default { initialize() {}, connectToDevTools() {} };
```

**Why it exists**: The `ink` package conditionally loads `react-devtools-core` when `process.env.DEV === true`. Even in production builds (where `DEV` is falsy), the bundler sees the import and tries to include the real `react-devtools-core` package. This package is large and has native dependencies that cannot be bundled into a `--compile` binary.

**Solution**: Register a no-op stub in `package.json`:
```json
"react-devtools-core": "file:./stubs/react-devtools-core"
```

When Bun bundles the code, it uses this stub instead of the real DevTools package. The stub satisfies `ink`'s `initialize()` / `connectToDevTools()` call surface with empty functions.

**Without the stub**: The build either fails (missing native dep) or produces a much larger binary.

---

## 4. TypeScript Configuration

**`tui/tsconfig.json`** key settings and their reasons:

| Option | Value | Reason |
|--------|-------|--------|
| `moduleResolution` | `bundler` | Bun/ESM-compatible import resolution |
| `module` | `Preserve` | Don't rewrite import/export syntax |
| `verbatimModuleSyntax` | `true` | Require explicit `type` imports; don't rewrite imports |
| `allowImportingTsExtensions` | `true` | Allow `import "./foo.ts"` (though `.js` is used in practice) |
| `target` | `ESNext` | No downleveling; Bun supports all modern JS |
| `lib` | `["ESNext"]` | Latest JS built-ins available |
| `jsx` | `react-jsx` | React 19 automatic JSX transform (no `React` import needed) |
| `strict` | `true` | All strict checks enabled |
| `noUncheckedIndexedAccess` | `true` | Array/object index access returns `T \| undefined` |
| `noFallthroughCasesInSwitch` | `true` | Enforces exhaustive switch statements |
| `resolveJsonModule` | `true` | Allows `import pkg from "../package.json"` to get version |
| `noUnusedLocals` | `false` | Unused variable warnings disabled (Biome handles this) |
| `skipLibCheck` | `true` | Skip type-checking `node_modules` (faster builds) |

**Version import pattern** (`index.ts`):
```typescript
import pkg from "../package.json";
// ...
version: pkg.version,  // e.g. "0.5.0"
```

---

## 5. Linting & Formatting (Biome)

**Root `biome.json`** applies to all workspaces. The TUI workspace has a thin override at `tui/biome.json` that extends it.

**Key rules**:
- **Tabs** for indentation (not spaces)
- **Double quotes** in JavaScript/TypeScript
- **`organizeImports: on`** — imports automatically sorted and grouped
- **`recommended: true`** — all Biome recommended lint rules enabled
- **Git integration** in root config; disabled in TUI workspace (`"useIgnoreFile": false`)

**Scripts**:
```
bun run lint    → biome check .
bun run format  → biome format --write .
```

Biome replaces both ESLint and Prettier. No ESLint config exists in this repo.

---

## 6. Turbo Pipeline

**`turbo.json`** defines task dependencies:

| Task | `dependsOn` | Notes |
|------|-------------|-------|
| `build` | `["^build"]` | Build deps first; outputs cached in `.turbo/` |
| `typecheck` | `["^build"]` | Requires build artifacts (web workspace) |
| `test:e2e` | `["build"]` | Requires built static site |
| `dev` | `[]` | `persistent: true`; never cached |
| `lint`, `format`, `test:unit` | `[]` | Run independently; no dependency ordering |

**Why `typecheck` depends on `build`**: The `web/` workspace imports types from built output. The TUI workspace doesn't have this issue but shares the pipeline definition.

---

## 7. Dependency Injection Pattern

Every module with external I/O (filesystem, network, process spawning) defines an injectable deps interface with production defaults. This is the canonical pattern throughout the codebase, established in `host/detectHost.ts`:

```typescript
export interface HostDeps {
  getPlatform(): string;
  getArch(): string;
  readOsRelease(): Promise<string | null>;
}

const defaultDeps: HostDeps = {
  getPlatform: () => process.platform,
  getArch: () => process.arch,
  readOsRelease: async () => { /* reads /etc/os-release */ },
};

export async function detectHost(deps = defaultDeps): Promise<HostInfo> {
  // uses deps.getPlatform(), deps.getArch(), deps.readOsRelease()
}
```

**Modules using this pattern**:

| Module | Deps interface | What's injectable |
|--------|---------------|-------------------|
| `host/detectHost.ts` | `HostDeps` | `getPlatform`, `getArch`, `readOsRelease` |
| `startup/startup.ts` | `FetchDeps` | All GitHub API calls, all cache ops, OAuth, event callback |
| `github/oauth.ts` | `OAuthDeps` | `fetch`, `openBrowser`, `onDeviceCode`, `scope` |
| `execution/scriptRunner.ts` | `Spawner` type | Child process spawning function |
| `sudo/sudoManager.ts` | `SudoDeps` | `spawnSync`, `spawnBackground`, `spawnAsync`, `spawnWithStdin` |
| `cache/cacheService.ts` | `baseDir` param | Base directory for cache files |
| `config/config.ts` | `baseDir` param | Base directory for config file |

**Key benefit**: Tests inject plain objects — no mocking libraries, no monkey-patching. Platform-specific behavior (e.g., Windows-only code paths) is testable on any OS.

---

## 8. Windows-Specific Implementation

### 8.1 Platform Normalization

`process.platform === "win32"` is always normalized to the internal string `"windows"` immediately in `detectHost.ts`. All downstream code uses `"windows"`, never `"win32"`.

### 8.2 Admin Check Instead of Sudo

Windows has no `sudo`. Instead:
- Manifest entries use `requires_admin: boolean` (forbidden on non-Windows)
- `requires_sudo: boolean` is forbidden on Windows entries (validation error if present)
- Admin check: spawns `net session` — exit 0 = running as Administrator

```typescript
// Spawned in background at app launch before TUI renders
const isAdminPromise =
    hostInfo.platform === "windows"
        ? checkIsAdmin()      // Bun.spawn(["net", "session"])
        : Promise.resolve(undefined);
```

The promise is started immediately so the result is ready (via `await`) by the time the user reaches the Confirmation screen (~1–3 s later).

### 8.3 Script Invocation via PowerShell

Unix uses `sh -c` inline; Windows writes the script to a temp `.ps1` file:

```typescript
// Windows spawner (scriptRunner.ts)
const tmpPath = join(tmpdir(), `scriptor-${Date.now()}-${Math.random()}.ps1`);
try {
    await Bun.write(tmpPath, scriptContent);
    const proc = Bun.spawn([
        "powershell.exe",
        "-NonInteractive",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", tmpPath,
        ...args,
    ], { stdout: "pipe", stderr: "pipe" });
    // ...stream output...
    return await proc.exited;
} finally {
    fs.unlink(tmpPath, () => {});  // best-effort cleanup
}
```

**Flag rationale**:
- `-NonInteractive`: Prevents PowerShell from prompting for input mid-script
- `-NoProfile`: Skips user/machine profile scripts (faster startup, no profile side-effects)
- `-ExecutionPolicy Bypass`: Allows unsigned `.ps1` files to run (users don't need to change their execution policy)
- `-File`: Execute the file (as opposed to `-Command` which uses a string)

### 8.4 Browser Opening for OAuth

Platform-specific shell commands for opening the verification URL:

```typescript
// oauth.ts
const cmd =
    process.platform === "win32"  ? `start "" "${url}"`
    : process.platform === "darwin" ? `open "${url}"`
    : `xdg-open "${url}"`;

await Bun.$`sh -c ${cmd}`.quiet().nothrow();  // non-fatal if fails
```

Non-fatal: if the browser doesn't open, the user can navigate manually. The verification URI is displayed prominently in the TUI.

### 8.5 AdminRequiredScreen

When the admin check fails and scripts require admin, the TUI shows `AdminRequiredScreen.tsx` with instructions to re-run as administrator. There is no privilege escalation from within the running process — the user must restart.

### 8.6 Argument Access in Scripts

| Platform | In script code |
|----------|---------------|
| Unix (`sh`) | `$1`, `$2`, … |
| Windows (PowerShell) | `$args[0]`, `$args[1]`, … |

Positional args are the collected input values, in input declaration order.

---

## 9. TTY Detection & Guarding

**Location**: `index.ts` (very first check in `main()`)

```typescript
if (!process.stdin.isTTY) {
    process.stderr.write(
        "[scriptor] ERROR: Scriptor requires an interactive terminal.\n" +
        "stdin is not a TTY — run Scriptor directly in a terminal, not piped.\n",
    );
    process.exit(1);
}
```

**Why it's necessary**:
- Ink requires raw mode on stdin to capture individual keypresses
- `ink` internally calls `stdin.setRawMode(true)`; if stdin is a pipe, this throws
- Without the guard, piped usage (`echo "" | scriptor`) would crash with a cryptic error from deep inside Ink
- The check is done before `render()` is called, so the error is clean

**Position**: This is literally the first thing `main()` does after parsing CLI args.

---

## 10. Process Spawning

All child processes use `Bun.spawn()` (async, streaming) or `Bun.spawnSync()` (blocking). There is no use of Node.js `child_process`.

### 10.1 Script Execution (Async, Streaming)

```typescript
const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
    // stdin not set → inherited (scripts do not read stdin)
});

const exitCode = await proc.exited;
```

Both stdout and stderr are captured as `ReadableStream<Uint8Array>`. Two independent async functions drain them in parallel via `Promise.all()` to avoid deadlock:

```typescript
await Promise.all([drainStream(proc.stdout, onStdout), drainStream(proc.stderr, onStderr)]);
```

### 10.2 Line Buffering

Each stream has its own `TextDecoder` and line buffer to handle chunked, partial-line output:

```typescript
const makeLineEmitter = (scriptId: string) => {
    let buf = "";
    const decoder = new TextDecoder();
    return {
        push(chunk: Uint8Array) {
            buf += decoder.decode(chunk, { stream: true });
            const parts = buf.split("\n");
            buf = parts.pop() ?? "";  // Keep partial line in buffer
            for (const raw of parts) {
                const line = raw.replace(/\r$/, "");  // Strip Windows \r
                if (line.length > 0) emit({ status: "output", scriptId, line });
            }
        },
        flush() {
            const line = buf.trim();
            if (line.length > 0) emit({ status: "output", scriptId, line: buf });
            buf = "";
        },
    };
};
```

**Why separate buffers**: stdout and stderr arrive concurrently from different file descriptors. If they shared a buffer, a partial line on stdout could be completed with bytes from stderr.

**Why `replace(/\r$/, "")`**: Windows processes emit `\r\n` line endings. After splitting on `\n`, each line still has a trailing `\r`. This strips it.

### 10.3 Sudo Spawning

Sudo operations use separate spawn calls with different options:

```typescript
// Non-interactive check
Bun.spawnSync(["sudo", "-n", "-v"], { stdout: "ignore", stderr: "ignore" });

// Password via stdin
const proc = Bun.spawn(["sudo", "-S", "-v"], {
    stdin: "pipe",
    stdout: "ignore",
    stderr: "ignore",
});
proc.stdin.write(`${password}\n`);
proc.stdin.end();
await proc.exited;

// Background keepalive (fire-and-forget)
Bun.spawn(["sudo", "-v"], {
    stdout: "ignore",
    stderr: "ignore",
    stdin: "ignore",
});
```

---

## 11. PowerShell UTF-8 Hack

**Problem**: PowerShell's `Write-Host` and `Write-Output` default to UTF-16 LE encoding when their output is piped to an external process. Bun reads the pipe as bytes and decodes with UTF-8, producing garbled output.

**Solution**: Prepend two encoding directives to every PowerShell script before writing to the temp file:

```typescript
const preamble = [
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "$OutputEncoding = [System.Text.Encoding]::UTF8",
    "",
].join("\n");

const scriptContent = preamble + originalScriptContent;
```

**Limitation** (documented in source comment):
> Native Windows commands (e.g., `wsl --install`) write UTF-16 LE directly to the pipe and bypass this setting; they must suppress or re-encode their output in the script.

This means any PowerShell script that calls native Windows executables (which pipe Unicode directly) must handle encoding in the script itself (e.g., pipe through `Out-String -Encoding utf8` or suppress output).

---

## 12. Ink & React Rendering

### 12.1 Versions

- **Ink**: 6.8.0
- **React**: 19.2.4
- **JSX transform**: React 19 automatic transform (`"jsx": "react-jsx"` in tsconfig)

### 12.2 Single Render Instance

Ink is rendered **once**:

```typescript
const { waitUntilExit } = render(
    React.createElement(App, { ...props }),
);
await waitUntilExit();
```

All screen switching is done through React state inside `App.tsx` — no `render()` / `unmount()` cycles. The Ink instance lives for the entire lifecycle of the TUI.

### 12.3 No React Optimization Hooks

There is no `React.memo`, `useMemo`, or `useCallback` anywhere in the TUI. This is intentional: the state updates are small and infrequent, and the list sizes are bounded (a few dozen scripts at most). Premature optimization was avoided.

### 12.4 No Concurrent React Features

No `<Suspense>`, `useTransition()`, `useDeferredValue()`, or streaming. Ink 6 does not support React concurrent rendering.

### 12.5 No Custom Hooks

All hooks used are React built-ins (`useState`, `useEffect`) or Ink built-ins (`useInput`, `useApp`, `useStdout`). No custom hooks exist in the codebase.

### 12.6 Static vs Dynamic Output

Ink's `<Static>` component is **not used**. All output is in the normal (dynamic) render region.

---

## 13. Key Input Handling

All keyboard input goes through Ink's `useInput` hook. The signature is:

```typescript
useInput(
    (input: string, key: Key) => void,
    options?: { isActive?: boolean }
);
```

- `input`: The printable character typed (empty string for non-printable keys)
- `key`: Flags object (`key.return`, `key.escape`, `key.upArrow`, `key.downArrow`, `key.backspace`, `key.delete`, `key.ctrl`, `key.meta`, `key.tab`, `key.shift`)

### 13.1 isActive Gating

Multiple `useInput` hooks can be active simultaneously, which causes conflicts. The `isActive` option disables a hook without removing it:

| Component | `isActive` condition |
|-----------|---------------------|
| `App.tsx` global quit | Disabled on `update`, `input-collection`, `sudo`, `admin` screens |
| `SudoScreen` input | Only active when `phase === "prompt"` |
| `UpdateScreen` keys | Only active when `phase === "prompt"` or `phase === "error"` |
| `InputCollectionScreen` cancel | Disabled when `confirmingCancel` modal is open |

### 13.2 Printable Character Guard

Input prompts only append printable characters to avoid capturing control sequences:

```typescript
useInput((input, key) => {
    if (input.length > 0 && !key.ctrl && !key.meta) {
        setValue((v) => v + input);
        setError(null);
    }
});
```

This allows `Ctrl+C` to propagate to the global quit handler even while an input is focused.

### 13.3 Cursor Rendering

Input cursor is rendered as an inverted-color space:

```tsx
<Box flexDirection="row">
    <Text>{label}: </Text>
    <Text>{value}</Text>
    <Text inverse={true}> </Text>   {/* blinking block cursor */}
</Box>
```

This is an Ink idiom — there is no native cursor positioning.

---

## 14. useStdout & Output Management

### 14.1 Why useStdout

Ink manages a virtual render buffer and syncs it to stdout. Writing directly to `process.stdout` from inside a React component can interleave with Ink's cursor management and corrupt terminal state.

`useStdout()` provides a `write` function that hooks into Ink's output pipeline, ensuring ordering:

```typescript
// ExecutionScreen.tsx
const { write: writeToStdout } = useStdout();
```

### 14.2 The 150ms Exit Delay

After execution completes (all scripts done or first failure), `ExecutionScreen` defers the Ink exit:

```typescript
setTimeout(() => {
    writeToStdout(`\nLog file: ${result.logFile}\n`);
    exit();
}, 150);
```

**Why 150ms**: Gives React and Ink one more render cycle to display the final "Execution complete. Exiting…" message before unmounting. Without this delay, Ink exits before the final state renders.

### 14.3 useStdout is Only Used in ExecutionScreen

All other components either:
- Don't write to stdout (they render via Ink's component tree)
- Write after Ink has exited (in `index.ts`, via direct `process.stdout.write()`)

---

## 15. Async Patterns & Race Conditions

### 15.1 Cancelled-Flag Pattern

Every `useEffect` that runs an async operation uses a `cancelled` flag to guard against state updates on unmounted/re-rendered components:

```typescript
// SudoScreen.tsx
useEffect(() => {
    let cancelled = false;
    validateSudo("").then((result) => {
        if (cancelled) return;  // Don't update state if effect re-ran
        if (result.ok) {
            onValidated();
        } else {
            setPhase("prompt");
        }
    });
    return () => {
        cancelled = true;  // Cleanup: effect is re-running or component unmounted
    };
}, [validateSudo, onValidated]);
```

This pattern appears in `SudoScreen.tsx`, `UpdateScreen.tsx`, and `SslCertInputPrompt.tsx`.

### 15.2 SslCertInputPrompt Step Guards

The SSL cert input has 4 steps (`url`, `fetching`, `select`, `downloading`). Each step's effect guards against in-flight async calls from the previous step:

```typescript
useEffect(() => {
    if (step !== "fetching") return;  // Guard: only run in this step
    fetcher.fetchChain(host, port)
        .then((chain) => {
            setCerts(chain);
            setStep("select");  // Advance step
        })
        .catch((err) => {
            setFetchError(err.message);
            setStep("url");     // Revert step on error
        });
}, [step, fetcher, host, port]);
```

If `step` changes while a fetch is in flight, the `.then()` callback fires but the `if (step !== "fetching")` guard at the top of the effect prevents another fetch from starting. The stale callback is idempotent (sets state that is immediately overwritten by the new step's effect).

### 15.3 Startup Effects (No Cancellation Needed)

The startup fetch effect in `App.tsx` does not use a cancellation flag:

```typescript
useEffect(() => {
    if (!startupEnabled) return;
    runStartup(repoUrl, (event) => setCurrentEvent(event))
        .then((result) => {
            setStartupResult(result);
            setFetchDone(true);
        });
}, [startupEnabled, repoUrl, runStartup]);
```

This is intentional: setting state twice is idempotent (React batches), and `startupEnabled` never becomes false after becoming true, so the effect never re-runs.

---

## 16. State Management

### 16.1 No Global State

All state is local to components via `useState`. There is no Context API, Redux, Zustand, or any other state library. State flows down through props, and actions flow up through callback props.

### 16.2 App-Level State

`App.tsx` owns the authoritative shared state:

```typescript
const [screen, setScreen] = useState<Screen>("fetch");
const [footerBindings, setFooterBindings] = useState(DEFAULT_BINDINGS);
const [currentEvent, setCurrentEvent] = useState<StartupEvent | null>(null);
const [fetchDone, setFetchDone] = useState(false);
const [offline, setOffline] = useState(false);
const [startupResult, setStartupResult] = useState<StartupResult | null>(null);
const [resolvedScripts, setResolvedScripts] = useState<ScriptEntry[]>([]);
const [scriptInputs, setScriptInputs] = useState<ScriptInputs>(() => new Map());
const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
const [startupEnabled, setStartupEnabled] = useState(!checkForUpdate);
const [sudoValidated, setSudoValidated] = useState(false);
```

### 16.3 Lazy Initializers

`useState` initializer functions are used for values that should not be recreated on every render:

```typescript
// ScriptInputs starts as an empty Map (not a literal to avoid identity changes)
const [scriptInputs, setScriptInputs] = useState<ScriptInputs>(() => new Map());

// CertFetcher is created once (or injected from outside for testing)
const [certFetcher] = useState<CertFetcher>(() => fetcher ?? new TlsCertFetcher());
```

### 16.4 Screen-to-Footer Binding Synchronization

Footer bindings are updated whenever the screen changes, via `setFooterBindings()` calls adjacent to `setScreen()` calls. There is no derived state or effect — it is explicit co-update.

---

## 17. Output Streaming Into Ink

**The problem**: Script output (stdout/stderr from child processes) arrives as async events during execution. The TUI must display the last N lines inside the Ink render tree.

**The solution**: Each `output` ProgressEvent triggers a React state update:

```typescript
function handleProgress(event: ProgressEvent) {
    if (event.status === "output") {
        setOutputLines((prev) => {
            const next = new Map(prev);
            const current = next.get(event.scriptId) ?? [];
            next.set(
                event.scriptId,
                [...current, event.line].slice(-MAX_OUTPUT_LINES),  // Last 8 lines
            );
            return next;
        });
    }
    // ...handle other events...
}
```

**`MAX_OUTPUT_LINES = 8`**: Only the 8 most recent lines per script are kept in state. This prevents the TUI from growing unboundedly and keeps the display clean.

**Output clearing**: On a `done` event (exit code 0), the output buffer for that script is deleted from the map (successful scripts don't need to show their output). On `failed`, the buffer is kept visible.

**Blank lines**: Filtered out in the line emitter; empty `output` events are never emitted.

**Note on the actual execution flow**: The Ink `ExecutionScreen` is shown briefly while the execution state machine is set up, then Ink exits and the actual execution streams directly to stdout in `index.ts`. The `ExecutionScreen` component in the Ink TUI is effectively a progress preview, not the primary output surface.

---

## 18. Screen Clearing

On `App` mount, the terminal is cleared once via ANSI escape codes:

```typescript
// App.tsx
useEffect(() => {
    process.stdout.write("\x1b[2J\x1b[H");
}, []);
```

- `\x1b[2J` — Erase entire display
- `\x1b[H` — Move cursor to home position (row 1, column 1)

**Why**: Any pre-render output (error messages, shell prompts) would otherwise show above the Ink TUI. Clearing gives a clean slate.

**Why direct `process.stdout.write`**: This runs once, synchronously, before Ink has established its render loop. At this point, writing directly to stdout is safe.

After this, Ink owns the terminal and handles all cursor movement internally via its diff-based render engine.

---

## 19. Two-Phase Execution Architecture

The TUI and script execution are deliberately separated into two phases, driven by a fundamental Ink limitation:

**The problem**: If scripts are executed while Ink's render loop is running, their stdout/stderr output interleaves with Ink's cursor-positioning escape sequences, producing garbled terminal output.

**The solution**: Use a shared mutable variable as a signal between the Ink phase and the execution phase:

```typescript
// index.ts
let executionTarget: { scripts: ScriptEntry[]; inputs: ScriptInputs } | null = null;

// Callback passed to App.tsx
onReadyToExecute: (scripts, inputs) => {
    executionTarget = { scripts, inputs };
    // App.tsx then calls exit() which resolves waitUntilExit()
},

// After Ink exits
await waitUntilExit();

if (executionTarget !== null) {
    // NOW run the scripts — Ink is fully unmounted
    const result = await runExecutionForApp(
        executionTarget.scripts,
        progressHandler,
        executionTarget.inputs,
    );
}
```

**Flow**:
1. User confirms in TUI → `onReadyToExecute` stores target in `executionTarget`
2. `App.tsx` calls `exit()` → Ink unmounts, cursor restored, `waitUntilExit()` resolves
3. `index.ts` checks `executionTarget !== null` → runs scripts via `ScriptRunner`
4. Script output streams directly to `process.stdout` (Ink is gone)

This is why there are two separate progress handlers: one for the brief Ink-phase display inside `ExecutionScreen.tsx`, and one for the real execution in `index.ts`.

---

## 20. Sudo Keepalive Mechanism

**The problem**: Sudo credentials expire after ~5 minutes by default. Long-running scripts would trigger a mid-execution sudo prompt if credentials expired.

**The solution**: Start a background keepalive after successful validation:

```typescript
// sudoManager.ts
const KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000;  // 4 minutes (before 5-min expiry)

export function startKeepalive(): () => void {
    const id = setInterval(() => {
        Bun.spawn(["sudo", "-v"], {
            stdin: "ignore",
            stdout: "ignore",
            stderr: "ignore",
        });
    }, KEEPALIVE_INTERVAL_MS);

    return () => clearInterval(id);
}
```

**Lifecycle**:
1. User validates sudo → `startKeepalive()` called → returns `stopKeepalive` function
2. Execution runs (possibly many minutes)
3. Every 4 minutes: `sudo -v` refreshes the credential timestamp silently
4. Execution completes (success or failure) → `finally` block: `stopKeepalive()` then `invalidateSudo()`

**Why `invalidateSudo()` after**:
- `sudo -k` explicitly revokes cached credentials
- Ensures no residual sudo access remains after Scriptor exits
- Called unconditionally (even on failure)

---

## 21. OAuth Token Polling

The device flow polling loop uses a deadline + backoff pattern:

```typescript
let pollIntervalMs = (interval ?? 5) * 1000;
const deadline = Date.now() + (expires_in ?? 900) * 1000;

while (Date.now() < deadline) {
    await sleep(pollIntervalMs);

    const { access_token, error, interval: slowDownInterval } =
        await pollTokenEndpoint();

    if (access_token) return access_token;

    switch (error) {
        case "authorization_pending": break;                         // Keep polling
        case "slow_down":
            pollIntervalMs = ((slowDownInterval ?? interval ?? 5) + 5) * 1000;
            break;                                                    // Slow down
        case "expired_token":   throw new OAuthError("...");
        case "access_denied":   throw new OAuthError("...");
        default: if (error) throw new OAuthError(`OAuth error: ${error}`);
    }
}

throw new OAuthError("Device authorization timed out.");
```

**Key details**:
- `slow_down` response: GitHub sends a new `interval`; the code adds 5 s as an additional buffer
- Default `expires_in`: 900 s (15 minutes) if GitHub doesn't specify
- Token is **never persisted to disk** — lives in memory only for the session
- Browser opening is non-fatal (wrapped in `.catch(() => {})`)

---

## 22. Binary Self-Update (Windows Limitation)

**Unix/Mac update** (`applyUpdate.ts`):
1. Download asset to a temp file in the same directory as the binary
2. `chmod(tmpPath, 0o755)` — make executable
3. `fs.renameSync(tmpPath, process.execPath)` — atomic replace (works even while running on Unix)

**Windows limitation**: Windows file locking prevents replacing a running executable. The workaround:
1. Download to `{binaryDir}/scriptor-new.exe`
2. Throw an error with instructions:
   > "Automatic update on Windows requires manual replacement. scriptor-new.exe has been downloaded to {binaryDir}. Please close Scriptor and replace scriptor.exe with scriptor-new.exe."

The update feature thus works silently on Unix/Mac but requires manual intervention on Windows.

---

## 23. Testing Infrastructure

### 23.1 TTY Mock Pattern

Every TUI component test that uses Ink's `render()` must provide mock TTY streams. The pattern is identical across all test files:

```typescript
function makeStdin(): NodeJS.ReadStream {
    const stream = new PassThrough() as unknown as NodeJS.ReadStream;
    (stream as any).isTTY = true;           // Required: Ink checks this
    (stream as any).setRawMode = () => {};  // Required: Ink calls this
    (stream as any).ref = () => {};         // Required by Ink internals
    (stream as any).unref = () => {};
    return stream;
}

function makeStdout(): NodeJS.WriteStream {
    const stream = new PassThrough() as unknown as NodeJS.WriteStream;
    (stream as any).columns = 80;          // Required: Ink uses for layout
    return stream;
}
```

**Why `as unknown as NodeJS.ReadStream`**: `PassThrough` doesn't satisfy the `ReadStream` interface, but Ink only needs `isTTY`, `setRawMode`, `ref`, and `unref`. The double cast bypasses TypeScript.

**Biome suppression**: These type casts require `// biome-ignore lint/suspicious/noExplicitAny: TTY mock` comments.

### 23.2 Wait Pattern

After simulating a keypress, a short wait is needed for React state to propagate and Ink to re-render:

```typescript
async function wait(ms = 80) {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// Usage:
stdin.push("y");
await wait();
// Now assert on rendered output
```

The 80 ms delay is empirical — enough for React batching + Ink's render cycle to complete.

### 23.3 Key Simulation

```typescript
async function typeAndSubmit(stdin: NodeJS.ReadStream, text: string) {
    stdin.push(text);       // Type characters
    await wait(50);
    stdin.push("\r");       // Press Enter (\r, not \n, because raw mode)
    await wait(50);
}
```

Note: In raw mode, Enter sends `\r` (carriage return), not `\n`.

### 23.4 Co-Located Tests

All tests live next to their source files as `.test.ts` or `.test.tsx`. No separate `__tests__/` directory. Run with `bun test`.

---

## 24. Bun-Specific APIs

The TUI uses Bun's native APIs throughout, replacing the Node.js equivalents:

| Operation | Bun API | Node.js equivalent (not used) |
|-----------|---------|-------------------------------|
| Read file | `Bun.file(path).text()` | `fs.promises.readFile` |
| Check file exists | `Bun.file(path).exists()` | `fs.promises.access` |
| Write file | `Bun.write(path, content)` | `fs.promises.writeFile` |
| Spawn process | `Bun.spawn(cmd, opts)` | `child_process.spawn` |
| Shell template | `Bun.$\`cmd\`` | `child_process.exec` |
| Sync spawn | `Bun.spawnSync(cmd, opts)` | `child_process.spawnSync` |

**`Bun.write()` creates parent directories automatically** — no `mkdir -p` equivalent needed before writing.

**`Bun.spawn()` returns a `ReadableStream`** for stdout/stderr, which is consumed via the standard Web Streams API (`getReader()`, `reader.read()`).

**Shell template `Bun.$`**: Used for OAuth browser-opening commands. `.quiet()` suppresses stdout/stderr. `.nothrow()` prevents throwing on non-zero exit (used for non-fatal operations like browser opening).

---

## Summary of Key Quirks

| Quirk | Location | Why |
|-------|----------|-----|
| `.js` extensions on `.ts` imports | All source files | Bundler-mode ESM resolution |
| `react-devtools-core` stub | `tui/stubs/` | Ink loads it conditionally; real package can't be compiled |
| TTY guard before render | `index.ts` | Ink crashes without interactive stdin |
| Screen clear on mount | `App.tsx` | Clean slate before TUI renders |
| 150 ms exit delay | `ExecutionScreen.tsx` | One extra Ink render cycle before unmount |
| `executionTarget` mutable variable | `index.ts` | Bridge from Ink phase to execution phase |
| PowerShell UTF-8 preamble | `scriptRunner.ts` | PowerShell defaults to UTF-16 LE on pipes |
| `\r$` stripping in line buffer | `scriptRunner.ts` | Windows CRLF from child processes |
| `sudo -k` after execution | `index.ts` | Revoke credentials; no residual access |
| 4-minute keepalive interval | `sudoManager.ts` | Before default 5-minute sudo timestamp expiry |
| OAuth token in memory only | `oauth.ts` | Security; never written to disk |
| Windows can't replace running binary | `applyUpdate.ts` | OS file locking; falls back to manual replacement |
| `cancelled` flag in async effects | `SudoScreen.tsx`, `SslCertInputPrompt.tsx` | Prevent stale async callbacks from updating state |
