# 003 Pre-Execution Flow — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — Types: CollectedInput, ScriptInputs, PreExecutionResult

**Status:** not started

**Description:**
Update `src/manifest/types.ts` to replace the `ScriptInputs` placeholder with the fully-typed `CollectedInput` structure, and add `PreExecutionResult` as the return type for the pre-execution orchestrator (Technical: TypeScript Types).

- Add `CollectedInput` interface: `{ value: string; certCN?: string }`
  - `value` for string/number inputs: the typed string (numbers stored as strings)
  - `value` for ssl-cert inputs: `inputDef.download_path` (from the manifest, not user-entered)
  - `certCN` only present for ssl-cert inputs: the CN of the selected certificate
- Change `ScriptInputs` from `Map<string, string>` to `Map<string, CollectedInput>`
- Update the JSDoc comment on `ScriptInputs` (remove the "placeholder" note)
- Add `PreExecutionResult` interface: `{ orderedScripts: ScriptEntry[]; inputs: ScriptInputs }`
- No changes to any other file in this task

**TDD Approach:**
- **RED:** Write tests in `src/manifest/types.test.ts` asserting: `CollectedInput` with only `value` is a valid type (no `certCN`), `CollectedInput` with both fields is valid, `ScriptInputs` is assignable as `Map<string, CollectedInput>`, type tests that verify the old `Map<string, string>` assignment is rejected
- **GREEN:** Add the new interfaces; TypeScript type tests pass, no runtime code changes needed
- Cover: CollectedInput with value only, CollectedInput with certCN, ScriptInputs Map type, PreExecutionResult shape

---

## Task 2 — SSL Helpers: Pure Parsing Functions

**Status:** not started

**Description:**
Implement the pure, I/O-free helper functions used by the SSL certificate chain walking logic (Technical: SSL Certificate Implementation).

- `src/pre-execution/sslCert.ts` — create file, implement:
  - `parseHostname(input: string): { host: string; port: number }` — parses all three formats: bare `host` (port 443), `host:port`, `https://host/path` (port 443). Strips trailing path from URL form. Port from string coerced to number.
  - `parseAiaUrl(infoAccess: string): string | null` — extracts the first `CA Issuers` URI from a `X509Certificate.infoAccess` string using regex `/CA Issuers - URI:(.+)/m`. Returns `null` if not found.
  - `toPem(derBuffer: Buffer): string` — wraps base64-encoded DER with `-----BEGIN CERTIFICATE-----` / `-----END CERTIFICATE-----` headers, 64 characters per line
  - `certRoleLabel(isLeaf: boolean, isSelfSigned: boolean): string` — returns `"[site]"`, `"[root]"`, or `""` (intermediate)
- `src/pre-execution/sslCert.test.ts` — create file with all tests

**TDD Approach:**
- **RED:** Write tests in `src/pre-execution/sslCert.test.ts` for all four pure functions before writing any implementation
- **GREEN:** Implement each function; all tests pass with no I/O
- Cover: parseHostname — bare host returns port 443, host:port extracts port, https:// URL returns port 443, https:// with custom port in URL returns that port, path stripped from URL; parseAiaUrl — returns URI when present, returns null when absent, handles multiple AIA entries (returns first CA Issuers), handles OCSP-only AIA; toPem — output starts with header, base64 wrapped at 64 chars, ends with footer; certRoleLabel — leaf returns [site], self-signed root returns [root], intermediate returns empty string

---

## Task 3 — SSL Helpers: Chain Fetch + Cert Download

**Status:** not started

**Description:**
Implement the I/O-heavy SSL helpers: TLS connection to fetch the leaf cert, AIA chain walking, and cert download to disk (Technical: SSL Certificate Implementation; Functional: SSL Certificate Input Steps 2 and 4).

- `src/pre-execution/sslCert.ts` — add to existing file:
  - `interface SslCertDeps { connectTls: (host: string, port: number) => Promise<Buffer>; fetchDer: (url: string, signal: AbortSignal) => Promise<Buffer>; mkdirSync: (path: string, opts: { recursive: boolean }) => void; writeFile: (path: string, data: Buffer | string) => Promise<void>; }`
  - `fetchCertChain(host: string, port: number, deps: SslCertDeps): Promise<CertInfo[]>` where `CertInfo = { der: Buffer; cn: string; validTo: string; isLeaf: boolean; isSelfSigned: boolean }`
    - Calls `deps.connectTls(host, port)` → raw DER Buffer of the leaf cert
    - Creates `X509Certificate` from DER; adds to chain as leaf
    - Walks AIA: while `chain.length < 10` and `parseAiaUrl(cert.infoAccess)` returns a URL: `deps.fetchDer(url, AbortSignal.timeout(10_000))` → next cert; appends to chain
    - Stops when self-signed (issuer === subject) or no AIA URL found
    - Returns chain reversed to root-first order
    - Throws `SslFetchError` (custom error class) on TLS connect failure or any `fetchDer` failure
  - `downloadCert(certDer: Buffer, downloadPath: string, format: "pem" | "der", deps: SslCertDeps): Promise<void>`
    - Calls `deps.mkdirSync(parent(downloadPath), { recursive: true })`
    - If `format === "pem"`: writes `toPem(certDer)` as UTF-8 string
    - If `format === "der"`: writes raw `certDer` Buffer
    - Overwrites without prompting if file exists
  - Export `SslFetchError` error class
- Real default implementation for `SslCertDeps`:
  - `connectTls`: wrap `node:tls` `tls.connect({ host, port, rejectUnauthorized: false })` → return `socket.getPeerCertificate(true).raw` on `secureConnect` event; close socket after
  - `fetchDer`: `fetch(url, { signal })` → `Buffer.from(await resp.arrayBuffer())`

**TDD Approach:**
- **RED:** Write tests in `src/pre-execution/sslCert.test.ts` with injected fake `connectTls` and `fetchDer` — both return raw `Buffer` values before any implementation
- **GREEN:** Implement `fetchCertChain` and `downloadCert`; all tests pass with fake deps
- Cover: single-cert chain (no AIA) returned root-first as [leaf], two-cert chain correctly reversed, AIA walk stops at depth 10, AIA walk stops when self-signed cert found, AIA fetch timeout aborts after 10s (verify AbortSignal.timeout used), connectTls failure throws SslFetchError, fetchDer failure throws SslFetchError, downloadCert PEM writes wrapped base64, downloadCert DER writes raw bytes, downloadCert creates parent directories, downloadCert overwrites existing file

---

## Task 4 — Elevation Pre-Flight

**Status:** not started

**Description:**
Implement the Windows-only admin check that runs synchronously before script execution (Functional: Elevation Pre-Flight; Technical: Two-Phase Architecture).

- `src/pre-execution/elevationPreFlight.ts` — create file:
  - `interface ElevationPreFlightDeps { platform: string; spawn: (cmd: string[], opts: SpawnOpts) => { exited: Promise<number> }; log: { error: (msg: string) => void }; exit: (code: number) => never; }`
  - `checkWindowsElevation(orderedScripts: ScriptEntry[], deps?: ElevationPreFlightDeps): Promise<"ok">` — note: never returns `"not-admin"` — it exits instead
    - If `deps.platform !== "win32"` or no script in `orderedScripts` has `requires_elevation: true`: return `"ok"` immediately
    - Spawn `["net", "session"]`; await `proc.exited`
    - If exit code is 0: return `"ok"`
    - Otherwise: call `deps.log.error(notAdminMessage)` then `deps.exit(1)`
  - The `notAdminMessage` constant is the multi-line admin instructions string from the functional spec
- `src/pre-execution/elevationPreFlight.test.ts` — create file

**TDD Approach:**
- **RED:** Write tests in `src/pre-execution/elevationPreFlight.test.ts` with injectable `spawn`, `log.error`, and `exit` before any implementation
- **GREEN:** Implement the check; pass a fake spawn returning a resolved exit code
- Cover: non-Windows platform returns "ok" immediately without spawning, no scripts with requires_elevation returns "ok" without spawning, net session exit code 0 returns "ok", net session exit code 1 calls log.error then exit(1), net session exit code 5 (access denied) calls log.error then exit(1), error message contains "Administrator Privileges Required", error message contains relaunch instructions

---

## Task 5 — Confirmation Screen

**Status:** not started

**Description:**
Implement the execution-plan display and confirm/back prompt (Functional: Confirmation Screen; Technical: `@clack/prompts` behavior notes).

- `src/pre-execution/confirmation.ts` — create file:
  - `formatExecutionPlan(orderedScripts: ScriptEntry[], inputs: ScriptInputs): string` — pure function, no deps; builds the multi-line plan string:
    - Heading: `"The following scripts will run in order:"`
    - Each script row: `"{index}. {name} — {description}"` (index dim, description dim via ANSI `\x1b[2m...\x1b[0m`)
    - Below each script, only inputs with non-empty `value` are listed indented:
      - string/number: `"  {label}: {value}"`
      - ssl-cert (has `certCN`): `"  {label}: {inputDef.download_path} ({certCN})"`
    - Footer: `"Y / Enter — Run these scripts   N / Esc — Go back to the script list"`
  - `interface ConfirmationDeps { confirm: (opts: { message: string }) => Promise<boolean | symbol>; isCancel: (val: unknown) => val is symbol; }`
  - `showConfirmation(orderedScripts: ScriptEntry[], inputs: ScriptInputs, deps?: ConfirmationDeps): Promise<"confirm" | "back">`
    - Calls `formatExecutionPlan` → passes result as the `message` to `deps.confirm()`
    - Returns `"confirm"` if result is `true`
    - Returns `"back"` if result is `false` or `isCancel(result)` (N, Esc, Ctrl+C all map to "go back")
- `src/pre-execution/confirmation.test.ts` — create file

**TDD Approach:**
- **RED:** Write tests in `src/pre-execution/confirmation.test.ts` with injectable `confirm` and `isCancel` fakes before any implementation
- **GREEN:** Implement `formatExecutionPlan` and `showConfirmation`; formatExecutionPlan is pure so test it directly
- Cover: formatExecutionPlan — numbered scripts in order, description dimmed, only non-empty inputs shown, string input formatted as label:value, ssl-cert formatted with download_path and certCN, scripts with no inputs show only name row; showConfirmation — confirm returning true → "confirm", confirm returning false → "back", confirm returning cancel symbol → "back", formatExecutionPlan output passed as message to confirm

---

## Task 6 — Input Collection: String + Number

**Status:** not started

**Description:**
Implement `collectInputs` for `string` and `number` input types. SSL-cert inputs are explicitly not yet handled — throw a descriptive error if encountered (to make the gap obvious until Task 7) (Functional: Input Collection Screen — String Input, Number Input, Queue Ordering, Cancel Behavior).

- `src/pre-execution/inputCollection.ts` — create file:
  - `interface InputCollectionDeps { text: (opts: TextOpts) => Promise<string | symbol>; isCancel: (val: unknown) => val is symbol; confirm: (opts: { message: string }) => Promise<boolean | symbol>; log: { error: (msg: string) => void }; exit: (code: number) => never; }`
  - `collectInputs(orderedScripts: ScriptEntry[], deps?: InputCollectionDeps): Promise<ScriptInputs>`
    - Builds a flat queue of `{ script: ScriptEntry, def: InputDef }` pairs from all selected scripts in order; returns empty Map immediately if queue is empty (no inputs at all)
    - For each item in queue:
      - Calls `deps.text({ message: dim(script.name) + "\n" + def.label, initialValue: def.default ?? "", validate })` where `dim(s) = "\x1b[2m" + s + "\x1b[0m"`
      - `validate` function:
        - If `def.required` and trimmed value is empty → return `"This field is required."`
        - If `def.type === "number"` and value is non-empty and `Number(value)` is `NaN` → return `"Please enter a valid number."`
      - If `isCancel(result)` → show cancel confirmation via `deps.confirm({ message: "Cancel input collection and exit? [y/N]" })`; if confirmed → `deps.exit(0)`; if declined → re-run the same prompt (loop)
      - On valid entry → store `CollectedInput { value: result }` in map under `def.id`
    - If `def.type === "ssl-cert"` → throw `new Error("ssl-cert inputs not yet implemented")` (temporary, removed in Task 7)
    - Return the filled `ScriptInputs` map
- `src/pre-execution/inputCollection.test.ts` — create file

**TDD Approach:**
- **RED:** Write tests in `src/pre-execution/inputCollection.test.ts` with injected fake `text`, `isCancel`, `confirm` before any implementation
- **GREEN:** Implement queue building and string/number handling; ssl-cert throws for now
- Cover: no inputs in any script → returns empty Map, string input stored under input id, number input stored under input id, required string rejects empty → validate returns error string, required string rejects whitespace-only, optional string accepts empty, number input rejects non-numeric (validate returns error string), number input accepts integer, number input accepts float, number input accepts negative, default value passed as initialValue, script name included in prompt message, cancel symbol on text → confirm shown, cancel confirm accepted → exit(0), cancel confirm declined → prompt re-shown for same input, inputs from multiple scripts collected in queue order

---

## Task 7 — Input Collection: SSL-Cert Flow

**Status:** not started

**Description:**
Extend `collectInputs` to handle the `ssl-cert` input type: four-step URL entry → chain fetch → certificate selection → download (Functional: SSL Certificate Input Steps 1–4).

- `src/pre-execution/inputCollection.ts` — extend `InputCollectionDeps` and `collectInputs`:
  - Add to `InputCollectionDeps`:
    - `select: (opts: SelectOpts) => Promise<number | symbol>` — returns the selected index
    - `spinner: () => { start: (msg: string) => void; stop: (msg: string) => void; }`
    - `fetchCertChain: (host: string, port: number) => Promise<CertInfo[]>`
    - `downloadCert: (certDer: Buffer, path: string, format: "pem" | "der") => Promise<void>`
  - Remove the `throw new Error("ssl-cert inputs not yet implemented")` placeholder
  - For `def.type === "ssl-cert"` inputs, run the four-step flow:
    - **Step 1** — `text()` for URL entry; `parseHostname(value)` to extract host/port; on cancel → cancel flow (same as string/number)
    - **Step 2** — `spinner.start("Fetching certificate chain…")`; call `fetchCertChain(host, port)`; `spinner.stop("")`; on `SslFetchError` → call `log.error(err.message)` and loop back to Step 1
    - **Step 3** — `select()` with one option per cert: label = `certRoleLabel + " " + cn` (trimmed), hint = `"Expires: " + validTo`; always shown even for single-cert chains; on cancel → cancel flow
    - **Step 4** — `spinner.start("Downloading certificate…")`; call `downloadCert(chain[idx].der, def.download_path, def.format ?? "pem")`; `spinner.stop("")`; on error → call `log.error(msg)` and loop back to Step 3
    - On success: store `CollectedInput { value: def.download_path, certCN: chain[idx].cn }`
- `src/pre-execution/inputCollection.test.ts` — extend with ssl-cert tests

**TDD Approach:**
- **RED:** Add ssl-cert tests to `src/pre-execution/inputCollection.test.ts` using injectable `fetchCertChain`, `downloadCert`, `select`, `spinner` fakes before extending implementation
- **GREEN:** Replace the throw with the four-step ssl-cert flow; all existing string/number tests still pass
- Cover: successful ssl-cert flow stores download_path as value and cert CN as certCN, select options use root-first order from fetchCertChain, select option label includes role label and CN, fetchCertChain error → log.error called → loops back to URL entry (text shown again), download error → log.error called → loops back to cert selection (select shown again), select cancel → cancel confirmation flow, ssl-cert step 1 cancel → cancel confirmation flow, single-cert chain still shows select prompt, cert downloaded with format from inputDef (pem/der), cert downloaded with format defaulting to pem when absent

---

## Task 8 — Pre-Execution Orchestrator

**Status:** not started

**Description:**
Implement `runPreExecution` — the coordinator that sequences input collection → confirmation (with back-loop) → elevation pre-flight and returns a `PreExecutionResult` (Technical: Wiring to `program.ts`; Functional: Post-Confirmation Routing).

- `src/pre-execution/index.ts` — create file:
  - `interface PreExecutionDeps { collectInputs: (scripts: ScriptEntry[]) => Promise<ScriptInputs>; showConfirmation: (scripts: ScriptEntry[], inputs: ScriptInputs) => Promise<"confirm" | "back">; checkWindowsElevation: (scripts: ScriptEntry[]) => Promise<"ok">; }`
  - `runPreExecution(selectionResult: ScriptSelectionResult, deps?: PreExecutionDeps): Promise<PreExecutionResult>`
    - Loop:
      1. `inputs = await deps.collectInputs(orderedScripts)` (skips entirely if no scripts have inputs — handled inside collectInputs)
      2. `result = await deps.showConfirmation(orderedScripts, inputs)`
      3. If `result === "back"` → continue loop from step 1 (inputs are discarded; re-collection starts from scratch per spec)
      4. If `result === "confirm"` → proceed
    - After confirmation: `await deps.checkWindowsElevation(orderedScripts)`
    - Return `{ orderedScripts, inputs }`
  - `makeDefaultDeps()` wires real implementations via lazy `require()` / `await import()` per the pattern from prior epics
- `src/pre-execution/index.test.ts` — create file

**TDD Approach:**
- **RED:** Write tests in `src/pre-execution/index.test.ts` with all three deps injected as fakes before any implementation
- **GREEN:** Implement the loop + elevation call; each branch driven by a failing test first
- Cover: happy path — collectInputs called → showConfirmation called with orderedScripts and inputs → checkWindowsElevation called → PreExecutionResult returned, back result causes collectInputs to be called again (inputs discarded), back followed by confirm proceeds normally, checkWindowsElevation not called until after confirmation, returned orderedScripts matches selectionResult.orderedScripts, returned inputs matches the Map from collectInputs

---

## Task 9 — Wire runPreExecution into program.ts

**Status:** not started

**Description:**
Replace the `deps.outro("Done")` stub in `program.ts` with a call to `runPreExecution`, threading the new dep through `ProgramDeps` (Technical: Wiring to `program.ts`).

- Add `runPreExecution: (selectionResult: ScriptSelectionResult) => Promise<PreExecutionResult>` to `ProgramDeps` in `src/program.ts`
- In the action handler, after `await deps.runScriptSelection(result)`:
  - Call `await deps.runPreExecution(selectionResult)` (store the result for the future execution epic)
  - Move `deps.outro("Done")` to after `runPreExecution` returns (it currently runs before pre-execution would)
- Wire real `runPreExecution` from `src/pre-execution/index.ts` as the default dep via lazy `await import()` in `src/index.ts`

**TDD Approach:**
- **RED:** Update `src/index.test.ts` — add `runPreExecution` to the fake `ProgramDeps`; add tests asserting `runPreExecution` is called with the `ScriptSelectionResult` returned by `runScriptSelection`, and that `outro` is called after `runPreExecution` completes; run tests to confirm they fail before wiring
- **GREEN:** Update `ProgramDeps` and the action handler in `program.ts`; update `index.ts` to wire the real dep; all existing tests still pass
- Cover: runPreExecution called with ScriptSelectionResult returned by runScriptSelection, outro called after runPreExecution returns, runPreExecution not called when --apply-update flag is present
