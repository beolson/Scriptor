# Bash Best Practices for Scriptor Scripts

## Required header

Every bash script must begin with:

```bash
#!/usr/bin/env bash
set -euo pipefail
```

- `-e` — exit immediately on any command failure
- `-u` — error on unset variables (catches typos in variable names)
- `-o pipefail` — catch failures anywhere in a pipeline, e.g. `curl ... | grep ...`

---

## Idempotency

Scripts must be safe to run more than once. The core rule: **check whether the effect already exists before performing the action.**

### Check before installing a package

```bash
if command -v curl &>/dev/null; then
    echo "curl is already installed, skipping"
else
    sudo apt-get update -y && sudo apt-get install -y curl
fi
```

### Safe directory creation

Always use `-p` so `mkdir` is a no-op if the directory exists:

```bash
mkdir -p "$HOME/.config/myapp"
```

### Guard file writes

```bash
if [ ! -f "/etc/myapp/config.conf" ]; then
    sudo tee /etc/myapp/config.conf <<'EOF'
key=value
EOF
fi
```

### Append vs. overwrite

Avoid `echo "..." >> file` — it accumulates duplicates on re-run. Check for the line first, or overwrite the whole file.

---

## Quoting

Always double-quote variables and command substitutions. Unquoted expansions split on whitespace and expand globs unexpectedly.

```bash
# Good
echo "$HOME"
cp "$source_file" "$dest_dir/"
curl -fsSL "$url" -o "$output"

# Bad
echo $HOME
cp $source_file $dest_dir/
```

---

## Variables

- **Constants / globals**: `SCREAMING_SNAKE_CASE`
- **Local variables**: `snake_case`
- Use `local` inside functions to prevent leaking into the outer scope:

```bash
install_package() {
    local pkg="$1"
    sudo apt-get install -y "$pkg"
}
```

---

## Functions

- Name with `snake_case`: `install_curl`, `check_prerequisites`, `configure_git`
- Define all functions before any logic runs
- One clear purpose per function

```bash
check_prerequisites() {
    if ! command -v curl &>/dev/null; then
        echo "Error: curl is required but not installed" >&2
        exit 1
    fi
}

install_node() {
    local version="$1"
    curl -fsSL "https://deb.nodesource.com/setup_${version}.x" | sudo -E bash -
    sudo apt-get install -y nodejs
}

check_prerequisites
install_node "20"
```

---

## Sudo — Minimal Privilege

**Never run the whole script as root.** Running as root corrupts file ownership (files created in `$HOME` become owned by root) and expands attack surface unnecessarily.

Prefix only the specific commands that require elevation:

```bash
# User-context operations — no sudo needed
mkdir -p "$HOME/.local/bin"
mkdir -p "$HOME/.config/myapp"

# Only the install step needs sudo
sudo apt-get update -y && sudo apt-get install -y curl

# Back to user context
curl -fsSL "https://example.com/tool" -o "$HOME/.local/bin/tool"
chmod +x "$HOME/.local/bin/tool"
```

### Sudo wrapper — for scripts that may run as root

If a script needs to work both as a regular user and as root (e.g. in containers):

```bash
if [ "$(id -u)" -eq 0 ]; then
    SUDO=""
else
    SUDO="sudo"
fi

$SUDO apt-get install -y curl
```

### Cache sudo credentials upfront

If several sudo calls are spread through the script, prompt once at the start rather than mid-script:

```bash
# Prompt for credentials now; keep them alive in background
sudo -v
while true; do sudo -n true; sleep 60; done &
SUDO_PID=$!
trap "kill $SUDO_PID 2>/dev/null" EXIT
```

---

## Error Handling

`set -e` catches most failures automatically. Add a trap for informative failure messages:

```bash
trap 'echo "Script failed on line $LINENO" >&2' ERR
```

For cleanup on exit (normal or error):

```bash
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
```

---

## Absolute Paths for System Binaries

For security-sensitive operations, use absolute paths rather than relying on `$PATH`:

```bash
/usr/bin/apt-get install -y curl   # explicit
# vs.
apt-get install -y curl            # depends on caller's $PATH
```

---

## Output Conventions

```bash
echo "Installing curl..."           # progress for the user
echo "Error: something failed" >&2  # errors go to stderr
```

Don't be chatty — but do tell the user what's happening at each meaningful step.

---

## Common ShellCheck Fixes

These are the issues ShellCheck most commonly flags:

| Problem | Fix |
|---------|-----|
| `$var` unquoted | `"$var"` |
| `` `cmd` `` backticks | `$(cmd)` |
| `which foo` | `command -v foo` |
| `[ condition ]` | `[[ condition ]]` |
| `source file` | `. file` (more portable) |
