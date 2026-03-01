# Scriptor

CLI tool that runs host-specific setup scripts from a GitHub repo.

## Releasing a New Version

Releases are automated via [Changesets](https://github.com/changesets/changesets). The flow is:

1. Developer adds a changeset alongside their code changes
2. After merge, the bot opens a "Version PR" that bumps `package.json` and `CHANGELOG.md`
3. Merging the Version PR automatically pushes a `v*` tag
4. The tag triggers `release.yml`, which builds and publishes the binaries to a GitHub Release

---

### Step 1 — Make your code changes

Work on your feature or fix as normal.

---

### Step 2 — Add a changeset

From the `source/` directory, run:

```sh
cd source
bun run changeset
```

The interactive prompt will ask you to:

1. **Select packages to include** — press `Space` to select `scriptor`, then `Enter`
2. **Choose the bump type**:
   - `patch` — bug fixes, internal changes (e.g. `0.1.0` → `0.1.1`)
   - `minor` — new backwards-compatible features (e.g. `0.1.0` → `0.2.0`)
   - `major` — breaking changes (e.g. `0.1.0` → `1.0.0`)
3. **Write a summary** — one line describing the change (this appears in `CHANGELOG.md`)

This creates a file in `source/.changeset/` such as `source/.changeset/fuzzy-dogs-dance.md`. Commit it alongside your code changes.

---

### Step 3 — Open a PR

Open a pull request as normal. CI runs tests and lint checks. The changeset file must be included in the PR.

---

### Step 4 — Merge the PR

After approval, merge into `main`. The `changeset.yml` workflow runs automatically and either:

- **Opens a "Version PR"** titled `chore: version packages` if changesets were found. This PR bumps `source/package.json` and updates `CHANGELOG.md`. No action needed yet.
- **Does nothing** if no changesets are pending.

---

### Step 5 — Review and merge the Version PR

When you are ready to ship the release, review the Version PR (check the version bump and changelog entry look correct), then merge it.

Merging triggers the `changeset.yml` workflow again, which:

1. Detects no pending changesets
2. Reads the version from `source/package.json`
3. Pushes a `v{version}` tag (e.g. `v0.2.0`)

---

### Step 6 — Wait for the release build

The `v*` tag triggers `release.yml`, which:

1. Runs tests and lint
2. Compiles binaries for Linux, macOS, and Windows (x64 + arm64)
3. Creates a GitHub Release and attaches all six binaries

Monitor progress at: `github.com/beolson/Scriptor/actions`

---

## One-time Setup (repository maintainers only)

The workflow requires a `CHANGESET_TOKEN` secret — a fine-grained PAT with these permissions on this repository:

| Permission | Level |
|------------|-------|
| Contents | Read and write |
| Pull requests | Read and write |
| Metadata | Read |

Create the token at `github.com/settings/personal-access-tokens/new`, then add it as a repository secret at `github.com/beolson/Scriptor/settings/secrets/actions` named `CHANGESET_TOKEN`.

The default `GITHUB_TOKEN` cannot be used here because commits pushed by Actions do not trigger other workflows unless a PAT is used.
