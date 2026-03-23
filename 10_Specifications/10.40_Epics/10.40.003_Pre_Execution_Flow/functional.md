# 003 Pre-Execution Flow

## Summary

Covers the two TUI screens between script selection and execution — Input Collection and Confirmation — followed by a raw-TTY execution phase. After the user confirms a script selection, the app gathers all required inputs across the selected scripts (string, number, SSL-certificate) and presents a full execution plan for review. On confirmation, the TUI exits. In the second phase, if any selected script requires elevation on Windows, Scriptor checks for Administrator privileges and exits with instructions if missing. Scripts then run directly in the terminal: Unix scripts requiring elevation are prefixed with `sudo` (which handles its own password prompting natively); all other scripts run without elevation.

---

## Business Value

Scripts often need runtime configuration values — email addresses, port numbers, custom CA certificates — that cannot be hard-coded in the script file. The input collection phase provides a structured, validated collection flow so scripts receive the correct values before any execution begins. The confirmation step gives users a last chance to review exactly what will run and with what values before any system changes are made. Separating the TUI phase (input, confirmation) from the execution phase (raw TTY) ensures scripts get a real terminal for interactive output, and sudo handles its own credential prompting naturally without Scriptor needing to manage it.

---

## User Stories

### Input Collection

- **Sequential queue**: As a user, I'm prompted for each required input across all selected scripts in order (script 1 inputs, then script 2 inputs, …) so I never have to hunt for what's needed.
- **String with default**: As a user, string inputs pre-fill with the declared default value so I can accept it by pressing Enter.
- **Required validation**: As a user, required inputs reject an empty or whitespace-only submission with a clear inline error.
- **Number validation**: As a user, number inputs reject non-numeric entries with a clear inline error.
- **SSL URL entry**: As a user, I enter a hostname (or `host:port` or `https://...` URL) to start certificate discovery.
- **SSL chain walking**: As a user, Scriptor automatically fetches the full certificate chain including intermediate CAs via AIA extension URLs, so I don't need to know where all certificates live.
- **SSL certificate selection**: As a user, I see a root-first list of discovered certificates and can navigate to select the one I need, even if there is only one.
- **SSL cert download**: As a user, the selected certificate is downloaded to the path declared in the manifest in the declared format (PEM or DER), with parent directories created automatically.
- **Cancel confirmation**: As a user, pressing Q or Ctrl+C shows a "Cancel and exit?" confirmation rather than immediately quitting.

### Confirmation Screen

- **Review execution plan**: As a user, I see a numbered list of every script that will run, in execution order, before anything executes.
- **Review collected inputs**: As a user, I see each script's collected input values (with values) indented below its name so I can verify correctness. Optional inputs I left blank are not shown.
- **SSL cert display**: As a user, SSL-cert inputs are shown as `{label}: {downloadPath} ({certCN})` so I can confirm the right certificate was fetched.
- **Confirm and proceed**: As a user, pressing Y or Enter confirms the plan, exits the TUI, and begins Phase 2 (elevation pre-flight if needed, then execution).
- **Go back**: As a user, pressing N or Esc returns me to the Script List with my selections intact.

### Elevation Pre-Flight (Windows only)

- **Already admin**: As a Windows user already running as Administrator, execution begins immediately with no interruption.
- **Not admin**: As a Windows user not running as Administrator, I see clear instructions explaining how to relaunch Scriptor with elevated privileges, then Scriptor exits cleanly.

> Unix elevation is handled natively by `sudo` during script execution — no pre-flight check or custom prompt is needed.

---

## Acceptance Criteria

### Input Collection Screen

**Queue Ordering**
- [ ] Inputs are collected in a flat queue: all inputs for script 1 (in manifest declaration order), then all inputs for script 2, and so on.
- [ ] Scripts with no inputs are silently skipped; the input screen is not shown at all if no selected script has any inputs.
- [ ] The queue is strictly forward-only: once a prompt is submitted it cannot be revisited.

**Layout**
- [ ] Each prompt displays the owning script name (dim) above the active input field.
- [ ] Active prompt format: `{label}: {value}█` (cursor at end).
- [ ] The standard footer is hidden; the screen manages its own key hints.

**String Input**
- [ ] If `default` is declared in the manifest, the input field is pre-filled with that value.
- [ ] Printable characters append to the current value; Backspace/Delete remove the last character.
- [ ] On Enter: if `required: true` and value is empty or whitespace-only → show inline error "This field is required."
- [ ] Inline errors clear on any keystroke.
- [ ] On Enter with a valid value: advance to the next prompt (or to Confirmation if queue is exhausted).

**Number Input**
- [ ] Same behavior as String input (pre-fill, backspace, required validation).
- [ ] Additional validation on Enter: if value is non-empty and `Number(value)` returns `NaN` → show inline error "Please enter a valid number."
- [ ] Integers, floats, and negative numbers are all accepted as valid.

**SSL Certificate Input — Step 1 (URL Entry)**
- [ ] Prompt accepts: `host`, `host:port`, or `https://host/path` (port defaults to 443).
- [ ] Backspace/Delete and printable characters work as in String input.
- [ ] Enter with a non-empty value transitions to Step 2.

**SSL Certificate Input — Step 2 (Fetching)**
- [ ] Displays "Fetching certificate chain…" (dim) while connecting.
- [ ] Connects to `host:port` via TLS; walks the AIA chain to a maximum depth of 10 certificates.
- [ ] Each individual AIA fetch has its own independent 10-second timeout.
- [ ] On error (connection failure, timeout, or AIA depth exceeded): shows error message (red); returns to Step 1.
- [ ] On success: advances to Step 3 regardless of chain length (including single-cert chains).

**SSL Certificate Input — Step 3 (Certificate Selection)**
- [ ] Certificates are displayed root-first (reversed from the leaf-first fetch order).
- [ ] Step 3 is always shown, even if only one certificate was found.
- [ ] Role labels: `[site]` on the leaf certificate, `[root]` on the self-signed root, blank on intermediates.
- [ ] Each row shows the certificate CN; the focused row also shows the expiry date.
- [ ] Navigate with `↑` / `↓`; confirm with `Enter`.

**SSL Certificate Input — Step 4 (Downloading)**
- [ ] Displays "Downloading certificate…" (dim) while writing.
- [ ] Parent directories of `download_path` are created automatically (equivalent to `mkdir -p`) before writing.
- [ ] Writes to `download_path` in the declared `format`:
  - **PEM**: base64-encoded DER wrapped with `-----BEGIN CERTIFICATE-----` / `-----END CERTIFICATE-----` headers, 64 characters per line.
  - **DER**: raw binary.
- [ ] If the file already exists at `download_path`, it is overwritten without prompting.
- [ ] On error: shows error message (red); returns to Step 3.
- [ ] On success: advances to the next prompt in the queue. The downloaded file is left on disk regardless of what happens next (including if the user later cancels).

**Stored Values**
- [ ] All input values are stored as strings internally (numbers stored as string representations).
- [ ] SSL-cert inputs store the `download_path` as the value and the certificate CN in a separate `certCN` field.

**Cancel Behavior**
- [ ] At any point (including within SSL steps), pressing Q or Ctrl+C shows:
  ```
  Cancel input collection and exit? [y/N]
  Press Y to confirm, N to resume.
  ```
- [ ] Pressing Y exits Scriptor cleanly with no scripts run. Any previously downloaded cert files remain on disk.
- [ ] Pressing N or Esc resumes at the current prompt without any change.

---

### Confirmation Screen

**Display**
- [ ] Heading: "The following scripts will run in order:"
- [ ] Each script is shown as a numbered row: `{index}. {name} — {description}` (index dim+bold, description dim).
- [ ] Scripts are shown in topological execution order (matching the actual run order exactly).
- [ ] Only inputs with a non-empty value are shown indented below their script row.
- [ ] String and number inputs: `{label}: {value}`
- [ ] SSL-cert inputs: `{label}: {downloadPath} ({certCN})`
- [ ] Scripts with no collected inputs (or all-blank optional inputs) show only the name/description row.
- [ ] Key binding summary below the list: `Y / Enter — Run these scripts` and `N / Esc — Go back to the script list`.

**Key Bindings**

| Key | Action |
|-----|--------|
| `Y` / `Enter` | Confirm; advance to Elevation Screen or exit TUI to begin execution |
| `N` / `Esc` | Return to Script List; selections preserved, collected inputs discarded |
| `Q` / `Ctrl+C` | Quit Scriptor |

**Post-Confirmation Routing**
- [ ] On confirm (Y / Enter): exit the TUI (`outro()`), then begin Phase 2 (elevation pre-flight if applicable, then script execution).
- [ ] Elevation routing and execution are handled outside the TUI — the Confirmation Screen has no knowledge of elevation status.

**Back Navigation**
- [ ] Pressing N or Esc returns to the Script List with all script selections intact.
- [ ] All previously collected inputs are discarded; re-confirming runs Input Collection again from the start.

---

### Elevation Pre-Flight (Windows only)

- [ ] The pre-flight check runs only if at least one selected script has `requires_elevation: true` and the platform is Windows.
- [ ] Runs `net session` synchronously; any non-zero exit code or spawn error is treated as "not admin."
- [ ] If admin (exit code 0): execution proceeds immediately with no output.
- [ ] If not admin: prints the following message to stdout and exits with a non-zero code:
  ```
  Administrator Privileges Required
  This script requires Administrator privileges.
  Scriptor is not currently running as Administrator.

  To fix this:
    1. Close Scriptor
    2. Right-click scriptor.exe
    3. Select "Run as administrator"
  ```

> Unix: no pre-flight check. Scripts with `requires_elevation: true` are run via `sudo bash {script}`. `sudo` handles its own credential prompting and caching natively in the TTY.

---

## Constraints

- The input collection queue is strictly forward-only; there is no back-navigation within the queue.
- Input values collected before returning to the Script List from Confirmation are discarded entirely; re-confirming runs Input Collection again from scratch.
- SSL AIA chain walking: each individual fetch has a 10-second timeout; maximum chain depth is 10 certs.
- SSL Step 3 (certificate selection) is always shown, even for single-cert chains.
- SSL cert files written to disk are never cleaned up by Scriptor, regardless of cancellation.
- Number inputs accept any value where `Number(value)` does not return `NaN` (integers, floats, negatives).
- The Confirmation Screen is always shown and cannot be skipped, even for a single script with no inputs.
- On Unix, sudo credential prompting and caching are handled entirely by the system `sudo` binary — Scriptor does not manage, validate, or keep alive sudo credentials.
- The Windows admin check (`net session`) runs synchronously inline before execution, only when at least one selected script requires elevation. Any non-zero exit or error is treated as "not admin."

---

## Out of Scope

- Backward navigation within the input queue (re-entering a previous prompt).
- Input persistence between Scriptor runs.
- Input types beyond `string`, `number`, and `ssl-cert`.
- SSL certificate chain trust / expiry validation — certs are fetched and presented without trust checking.
- Custom sudo password prompting — `sudo` handles its own prompting natively.
- Linux `pkexec` or graphical sudo prompts.
- Windows UAC prompt elevation from within a running process.
- Per-script elevation (elevation is checked once for the entire run set, not per-script).
- Sudo keepalive — `sudo`'s own credential caching is sufficient.

---

## Open Questions

- None.
