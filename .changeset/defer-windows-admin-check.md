---
"scriptor": minor
---

Optimize Windows startup time by deferring the admin check

The `net session` subprocess that checks Administrator status used to block
the first TUI render on Windows (50–500ms). `checkIsAdmin()` is now a
standalone export that starts in the background before Ink renders and is
awaited only when the user presses Run — effectively free by that point.
`detectHost()` no longer sets `isAdmin`; callers that need it should call
`checkIsAdmin()` directly.
