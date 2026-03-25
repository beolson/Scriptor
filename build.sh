#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TUI_DIR="$REPO_ROOT/20_Applications/tui"
DIST_DIR="$REPO_ROOT/20_Applications/dist"
VERSION=$(bun -e "import p from './20_Applications/tui/package.json'; console.log(p.version)")

mkdir -p "$DIST_DIR"

echo "Building Scriptor $VERSION binaries..."

cd "$TUI_DIR"

bun build src/index.ts --compile --define "VERSION=\"$VERSION\"" --target=bun-linux-x64     --outfile "$DIST_DIR/scriptor-linux-x64"
bun build src/index.ts --compile --define "VERSION=\"$VERSION\"" --target=bun-linux-arm64   --outfile "$DIST_DIR/scriptor-linux-arm64"
bun build src/index.ts --compile --define "VERSION=\"$VERSION\"" --target=bun-darwin-x64    --outfile "$DIST_DIR/scriptor-darwin-x64"
bun build src/index.ts --compile --define "VERSION=\"$VERSION\"" --target=bun-darwin-arm64  --outfile "$DIST_DIR/scriptor-darwin-arm64"
bun build src/index.ts --compile --define "VERSION=\"$VERSION\"" --target=bun-windows-x64   --outfile "$DIST_DIR/scriptor-windows-x64.exe"

echo "Build complete. Binaries in 20_Applications/dist/"

echo "Copying scriptor-windows-x64.exe to /mnt/c..."
cp "$DIST_DIR/scriptor-windows-x64.exe" /mnt/c/Users/beols/scriptor.exe
echo "Copied to /mnt/c/scriptor.exe"
