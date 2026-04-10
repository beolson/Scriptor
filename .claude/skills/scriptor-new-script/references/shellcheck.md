# ShellCheck: Installation and Usage

ShellCheck is a static analysis tool for shell scripts. It catches common bugs, unsafe practices, and portability issues before they cause problems at runtime.

---

## Installation

### Ubuntu / Debian (including WSL)

```bash
sudo apt-get install shellcheck
```

### macOS

```bash
brew install shellcheck
```

### Verify

```bash
shellcheck --version
```

---

## Basic Usage

Run against a single script:

```bash
shellcheck scripts/linux/ubuntu-24.04-x64/install-curl.sh
```

Run against all `.sh` files in the project:

```bash
shellcheck scripts/**/*.sh scripts-fixture/**/*.sh
```

A clean run produces no output and exits with code 0.

---

## Reading the Output

```
In install-curl.sh line 17:
sudo apt-get install -y $PACKAGE
                        ^------^ SC2086 (warning): Double quote to prevent globbing and word splitting.

Did you mean:
sudo apt-get install -y "$PACKAGE"
```

Each issue shows:
- The file, line number, and offending code
- An `SC####` code identifying the specific rule
- The severity: `error`, `warning`, `info`, or `style`
- Often a suggested fix

Full documentation for any rule: `https://www.shellcheck.net/wiki/SC####`

---

## Most Common Issues and Fixes

| Issue | SC Code | Fix |
|-------|---------|-----|
| Unquoted variable | SC2086 | `"$var"` instead of `$var` |
| Unquoted command substitution | SC2046 | `"$(cmd)"` instead of `$(cmd)` |
| `which` instead of `command -v` | SC2230 | `command -v tool` |
| Backtick substitution | SC2006 | `$(cmd)` instead of `` `cmd` `` |
| `[ ]` test in bash | SC2039 | `[[ condition ]]` |
| Unquoted `$@` or `$*` | SC2068 | `"$@"` |
| Array expansion without quotes | SC2068 | `"${arr[@]}"` |

---

## Suppressing False Positives

Rarely needed. If a warning is genuinely a false positive, disable it inline with a comment on the line **before** the offending code:

```bash
# shellcheck disable=SC2086
echo $intentionally_unquoted_for_word_splitting
```

Prefer fixing the issue over suppression — suppressions mask real problems added later.

---

## Adding `lint:shell` to the Project

To run ShellCheck as part of the project's lint workflow, add to `package.json`:

```json
"lint:shell": "shellcheck scripts/**/*.sh scripts-fixture/**/*.sh"
```

Then run with:

```bash
bun run lint:shell
```

This can also be added as a step in `.github/workflows/ci.yml` — `ubuntu-latest` GitHub Actions runners have ShellCheck pre-installed via apt, so no install step is needed in CI.
