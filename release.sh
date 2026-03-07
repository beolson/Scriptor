#!/usr/bin/env bash
# Usage: ./release.sh
#
# Applies pending changesets, commits the version bump, tags, and pushes.
# Run `cd tui && bun run changeset` first to describe your changes.
set -euo pipefail

cd tui

# Fail fast if there are no pending changesets
if ! ls .changeset/*.md 2>/dev/null | grep -qv README; then
  echo "No changesets found. Run 'bun run changeset' first to describe your changes."
  exit 1
fi

# Apply version bump and update CHANGELOG.md
bun run version

# Read the new version
VERSION=$(node -p "require('./package.json').version")

cd ..

# Commit, tag, and push
git add tui/package.json tui/CHANGELOG.md "tui/.changeset/"
git commit -m "chore: release v$VERSION"
git tag "v$VERSION"
git push
git push origin "v$VERSION"

echo "Released v$VERSION — release.yml is now building the binaries."
