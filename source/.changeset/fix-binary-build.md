---
"scriptor": patch
---

Fix compiled binary failing at runtime with missing react-devtools-core package. Bundle a local no-op stub so the binary is fully self-contained on all platforms.
