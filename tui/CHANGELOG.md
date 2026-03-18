# scriptor

## 0.9.0

### Minor Changes

- 71594ef: Optimize Windows startup time by deferring the admin check

  The `net session` subprocess that checks Administrator status used to block
  the first TUI render on Windows (50–500ms). `checkIsAdmin()` is now a
  standalone export that starts in the background before Ink renders and is
  awaited only when the user presses Run — effectively free by that point.
  `detectHost()` no longer sets `isAdmin`; callers that need it should call
  `checkIsAdmin()` directly.

- 1d70dd4: Bug fixes

## 0.8.0

### Minor Changes

- 447bfd0: Update our scripts and install process

## 0.7.0

### Minor Changes

- 65b4691: Updates to web and tui

## 0.6.0

### Minor Changes

- c1b0493: Update Website

## 0.5.0

### Minor Changes

- e25fcfc: Update

## 0.4.0

### Minor Changes

- Update

## 0.3.0

### Minor Changes

- Updates

## 0.2.0

### Minor Changes

- Added support for inputs into the scripts

## 0.1.5

### Patch Changes

- a2696d9: Fix compiled binary failing at runtime with missing react-devtools-core package. Bundle a local no-op stub so the binary is fully self-contained on all platforms.

## 0.1.4

### Patch Changes

- update

## 0.1.3

### Patch Changes

- updates

## 0.1.2

### Patch Changes

- Updates

## 0.1.1

### Patch Changes

- Testing
