# PowerShell Best Practices for Scriptor Scripts

## Required header

Every PowerShell script must begin with:

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
```

- `Set-StrictMode -Version Latest` — errors on uninitialized variables, deprecated syntax, and other unsafe patterns
- `$ErrorActionPreference = 'Stop'` — turns non-terminating errors into terminating ones, so they're caught by `try/catch`

---

## Idempotency

Scripts must be safe to run more than once. Check whether the effect already exists before performing the action.

### Check before installing

```powershell
if (Get-Command git -ErrorAction SilentlyContinue) {
    Write-Host "Git is already installed, skipping"
} else {
    winget install --id Git.Git --silent --accept-source-agreements --accept-package-agreements
}
```

### Check if a package is installed via winget

```powershell
$installed = winget list --id Git.Git 2>$null
if ($installed -match 'Git.Git') {
    Write-Host "Git already installed"
} else {
    winget install --id Git.Git --silent --accept-source-agreements --accept-package-agreements
}
```

---

## Error Handling

```powershell
try {
    winget install --id Git.Git --silent --accept-source-agreements --accept-package-agreements
} catch {
    Write-Error "Failed to install Git: $_"
    exit 1
}
```

Use specific exception types when you know them:

```powershell
try {
    # ...
} catch [System.IO.FileNotFoundException] {
    Write-Error "File not found: $_"
    exit 1
} catch {
    Write-Error "Unexpected error: $_"
    exit 1
}
```

---

## Admin Elevation

### Check for admin rights

```powershell
function Test-IsAdmin {
    ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)
}
```

### Fail early with a clear message (preferred)

When a script requires elevation throughout, fail at the top with an actionable message:

```powershell
if (-not (Test-IsAdmin)) {
    Write-Host "This script requires administrator privileges." -ForegroundColor Red
    Write-Host "Please right-click PowerShell and choose 'Run as Administrator', then try again."
    exit 1
}
```

### Self-elevate (use sparingly)

Self-elevation relaunches the script in a new elevated window. It's convenient but loses the current terminal context and output — the user may not see errors. Prefer the fail-early approach.

```powershell
if (-not (Test-IsAdmin)) {
    Start-Process pwsh -Verb RunAs -ArgumentList "-File `"$PSCommandPath`""
    exit
}
```

### Minimal elevation

If only specific steps need elevation, structure the script so those steps are clearly isolated. PowerShell doesn't have a `sudo`-prefix equivalent, so scripts that require elevation typically need to be run elevated from the start. However, you can call separate scripts or functions with a clear note:

```powershell
# This step requires elevation — the script should be run as Administrator
Install-AdminFeature

# These steps run fine as a standard user
Configure-UserSettings
```

---

## Naming Conventions

- **Functions**: `Verb-Noun` in PascalCase — `Install-Git`, `Test-IsAdmin`, `Get-PlatformInfo`
- **Module-level variables**: `$PascalCase`
- **Local/loop variables**: `$camelCase`
- **Constants**: Use `[System.Environment]::GetEnvironmentVariable()` or `$SCREAMING_SNAKE_CASE`

---

## Winget Pattern

Most Windows scripts in this project use winget. Standard pattern:

```powershell
winget install --id <Publisher.Package> `
    --silent `
    --accept-source-agreements `
    --accept-package-agreements
```

Always check that winget is available before using it:

```powershell
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Error "winget (App Installer) is required. Install it from the Microsoft Store."
    exit 1
}
```

Common winget IDs for reference:
- `Git.Git` — Git for Windows
- `Microsoft.VisualStudioCode` — VS Code
- `Microsoft.PowerShell` — PowerShell 7+
- `Chocolatey.Chocolatey` — Chocolatey package manager

---

## Output Conventions

```powershell
Write-Host "Installing..."                     # progress shown to user
Write-Host "Done." -ForegroundColor Green      # success
Write-Host "Warning: ..." -ForegroundColor Yellow
Write-Error "Something failed"                 # stderr equivalent
Write-Verbose "Detail..."                      # only shown with -Verbose flag
```

---

## Notes on `#Requires`

For scripts that always require a specific PowerShell version or elevation, `#Requires` at the top is the cleanest approach:

```powershell
#Requires -Version 5.1
#Requires -RunAsAdministrator
```

`#Requires -RunAsAdministrator` causes PowerShell to show a clear error immediately if not elevated, before any code runs. Use this instead of the manual `Test-IsAdmin` check when the entire script needs admin.
