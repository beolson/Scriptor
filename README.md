# Scriptor

CLI tool that runs host-specific setup scripts from a GitHub repo.

## Releasing a New Version

Releases use [Changesets](https://github.com/changesets/changesets) to track what changed, and a local `release.sh` script to apply the version bump, tag, and push. Pushing a `v*` tag triggers `release.yml`, which builds and publishes the binaries.

---

### Step 1 — Make your code changes

Work on your feature or fix as normal.

---

### Step 2 — Add a changeset

From the `tui/` directory, run:

```sh
cd tui
bun run changeset
```

The interactive prompt will ask you to:

1. **Select packages to include** — press `Space` to select `scriptor`, then `Enter`
2. **Choose the bump type**:
   - `patch` — bug fixes, internal changes (e.g. `0.1.0` → `0.1.1`)
   - `minor` — new backwards-compatible features (e.g. `0.1.0` → `0.2.0`)
   - `major` — breaking changes (e.g. `0.1.0` → `1.0.0`)
3. **Write a summary** — one line describing the change (this appears in `CHANGELOG.md`)

This creates a file in `tui/.changeset/` such as `tui/.changeset/fuzzy-dogs-dance.md`. Commit it alongside your code changes.

---

### Step 3 — Open a PR and merge

Open a pull request as normal. CI runs tests and lint checks. The changeset file must be included in the PR. After approval, merge into `main`.

---

### Step 4 — Run the release script

When you are ready to ship, run from the repo root:

```sh
./release.sh
```

This will:

1. Apply all pending changesets (`changeset version`) — bumps `tui/package.json` and writes `tui/CHANGELOG.md`
2. Commit the version bump
3. Tag the commit as `v{version}` (e.g. `v0.2.0`)
4. Push the commit and tag to `main`

---

### Step 5 — Wait for the release build

The `v*` tag triggers `release.yml`, which:

1. Runs tests and lint
2. Compiles binaries for Linux, macOS, and Windows (x64 + arm64)
3. Creates a GitHub Release and attaches all six binaries

Monitor progress at: `github.com/beolson/Scriptor/actions`
