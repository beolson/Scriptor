# Technical Standards — 003 Pre-Execution Flow

## Runtime & Language

Unchanged from epics 001–002:

- Runtime: Bun (compiled binary via `bun build --compile`)
- Language: TypeScript (strict mode, ESNext target, Preserve module resolution)
- Version constraints: Bun latest stable; TypeScript ^5

## Key Libraries & Frameworks

Carries over from epics 001–002. New usage in this epic:

- TUI (Phase 1): `@clack/prompts` — `text()` (string/number/SSL URL inputs), `select()` (SSL cert selection), `confirm()` (confirmation screen), `spinner()` (SSL fetch/download progress)
- SSL certs: `node:tls` — TLS socket to obtain the leaf certificate (`socket.getPeerCertificate(true).raw`); `node:crypto` `X509Certificate` — parse AIA extension URLs (via `.infoAccess` regex), export PEM (`.toString()`) and DER (`.export()`)
- Elevation pre-flight (Phase 2, Windows only): `Bun.spawn(["net", "session"])` — synchronous admin check before script execution
- No new package dependencies

## Tooling

Unchanged from epics 001–002:

- Build: `bun build` with `--compile`
- Test: `bun test` (co-located `.test.ts` files, injectable deps pattern)
- Lint/Format: Biome (tabs, double quotes)
- Package manager: Bun only

## APIs & External Services

- SSL AIA intermediate cert URLs: `fetch()` (standard HTTP GET, no auth; response body treated as DER bytes)
- No new GitHub API usage in this epic

## Two-Phase Architecture

This epic introduces a clean separation between TUI mode and TTY mode:

**Phase 1 — TUI/clack** (this epic):
- Input Collection — `@clack/prompts` `text()` / `select()` / `spinner()`
- Confirmation Screen — `@clack/prompts` `confirm()` with the execution plan as the message body
- On confirm: `outro()` → exit clack mode

**Phase 2 — raw TTY** (this epic: elevation pre-flight only; script execution is a future epic):
- Windows pre-flight: if any script requires elevation → `net session` check → if not admin, print message and exit
- Script execution: scripts run directly in the terminal with full stdin/stdout/stderr. Unix scripts with `requires_elevation: true` are run via `sudo bash {script}`; `sudo` handles its own credential prompting natively.

## Module Layout

All three concerns (input collection, confirmation, elevation pre-flight) share a single directory:

```
src/pre-execution/
  index.ts              # runPreExecution(selectionResult, deps?): Promise<PreExecutionResult>
  index.test.ts
  inputCollection.ts    # collectInputs(orderedScripts, deps?): Promise<ScriptInputs>
  inputCollection.test.ts
  confirmation.ts       # showConfirmation(orderedScripts, inputs, deps?): Promise<"confirm" | "back">
  confirmation.test.ts
  elevationPreFlight.ts # checkWindowsElevation(deps?): Promise<"ok" | "not-admin">
  elevationPreFlight.test.ts
  sslCert.ts            # fetchCertChain(), downloadCert() — pure SSL helpers with injectable deps
  sslCert.test.ts
```

## TypeScript Types

### CollectedInput (replaces `ScriptInputs` placeholder in `src/manifest/types.ts`)

```typescript
interface CollectedInput {
  /** The resolved value for this input.
   *  - string/number: as typed by the user (numbers stored as string)
   *  - ssl-cert: the download_path declared in the manifest (InputDef.download_path) */
  value: string;
  /** Only present for ssl-cert inputs: the CN of the selected certificate. */
  certCN?: string;
}

type ScriptInputs = Map<string, CollectedInput>;
```

For ssl-cert inputs the user provides:
1. A host URL (used for TLS connection and AIA chain walking)
2. A certificate selection from the discovered chain

`download_path` and `format` come from the manifest's `InputDef` passthrough fields — not from user input. `CollectedInput.value` is set to `inputDef.download_path` after the cert is downloaded.

### PreExecutionResult

```typescript
interface PreExecutionResult {
  orderedScripts: ScriptEntry[];
  inputs: ScriptInputs;
}
```

### Confirmation screen display logic

```
ssl-cert      → "{label}: {inputDef.download_path} ({collectedInput.certCN})"
string/number → "{label}: {collectedInput.value}"
```

## SSL Certificate Implementation

### Chain walking algorithm

```
1. tls.connect({ host, port, rejectUnauthorized: false })
2. leaf = new X509Certificate(socket.getPeerCertificate(true).raw)
3. chain = [leaf]
4. while chain.length < 10:
     aiaUrl = parseAiaUrl(current.infoAccess)   // regex: /CA Issuers - URI:(.+)/
     if no aiaUrl → break (self-signed or no AIA)
     resp = await fetch(aiaUrl, { signal: AbortSignal.timeout(10_000) })
     next = new X509Certificate(Buffer.from(await resp.arrayBuffer()))
     chain.push(next)
     current = next
5. reverse chain → root-first order for display
```

### PEM export (64-char line wrapping)

```typescript
function toPem(cert: X509Certificate): string {
  const b64 = cert.export().toString("base64");
  const lines = b64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----\n`;
}
```

### DER export

```typescript
cert.export() // returns Buffer (raw DER bytes) — write directly to download_path
```

## Wiring to `program.ts`

```typescript
// After script selection, in the program.ts action handler:
const preExecResult = await deps.runPreExecution(selectionResult);
// Phase 2 (execution) begins after this returns
```

`ProgramDeps` gains one new field:

```typescript
runPreExecution: (
  selectionResult: ScriptSelectionResult,
) => Promise<PreExecutionResult>;
```

`runPreExecution` is responsible for:
1. Calling `collectInputs()` (skipped entirely if no selected script has inputs)
2. Calling `showConfirmation()` — loops back to script selection if user presses N/Esc
3. Calling `checkWindowsElevation()` (skipped on non-Windows or if no script requires elevation)
4. Returning `PreExecutionResult`

The `net session` check is **not** started at app launch — it runs inline inside `checkWindowsElevation()` only when needed.

## Architecture Patterns

All carry over from epics 001–002:

- Injectable deps on all functions with side effects; real implementations wired in `makeDefaultDeps()` via lazy dynamic import
- `@clack/prompts` calls wrapped in module-level helper functions with injectable `ClackDeps`

### `@clack/prompts` behavior notes

| Screen | Primitive | Note |
|---|---|---|
| Input collection (string/number) | `text()` with `validate` | Validation error shown on Enter, cleared on next submit. |
| SSL URL entry | `text()` | None |
| SSL cert selection | `select()` with `hint` | `hint` (expiry date) shows on all rows, not only focused. Minor deviation from spec. |
| Confirmation | `confirm()` | N and Esc both return cancel symbol → treated as "go back." Q is not handled by clack; Ctrl+C exits via SIGINT. |

## Constraints & Non-Goals

- All dependencies must be pure JS/TS — no native modules (Bun binary compilation constraint)
- No new package dependencies — SSL cert handling via `node:tls` + `node:crypto` built-ins only
- Input collection queue is strictly forward-only — no back-navigation within the queue
- AIA chain walk: each fetch has a 10-second timeout (via `AbortSignal.timeout`); maximum depth 10
- SSL cert files on disk are never cleaned up by Scriptor
- Unix sudo credential prompting and caching handled entirely by the system `sudo` binary — no keepalive, no `sudo -S`, no pre-validation
- Windows admin check (`net session`) runs synchronously inline; only when at least one selected script requires elevation

## Open Questions

- None.
