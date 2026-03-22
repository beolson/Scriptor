// Test setup: inject build-time globals that bun build --define provides at runtime.
// This file is loaded via bunfig.toml [test].preload so tests can reference VERSION.
import pkg from "../package.json";

// Inject VERSION as a global to match the build-time --define injection.
// biome-ignore lint/suspicious/noExplicitAny: intentional global injection for tests
(globalThis as any).VERSION = pkg.version;
