// @vitest-environment node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { LoadScriptsDeps } from "./loadScripts.js";
import { defaultDeps, loadScripts } from "./loadScripts.js";

// Navigate from lib/ → scriptor-web/ → 20_Applications/ → repo root → scripts-fixture/
const fixtureDir = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../..",
	"scripts-fixture",
);

// Helper to build a minimal spec file string using new single-field platform
function makeSpec(overrides: Record<string, string> = {}): string {
	const fm = {
		platform: "ubuntu-24.04-x64",
		title: "Install curl",
		description: "Installs curl on the system.",
		...overrides,
	};
	const yamlLines = Object.entries(fm)
		.map(([k, v]) => `${k}: ${v}`)
		.join("\n");
	return `---\n${yamlLines}\n---\n\nThis installs curl on the system.\n`;
}

// Minimal deps factory — callers override what they need
function makeDeps(overrides: Partial<LoadScriptsDeps> = {}): LoadScriptsDeps {
	return {
		glob: async function* () {},
		readFile: async () => "",
		scriptsDir: "/fake/scripts",
		...overrides,
	};
}

describe("loadScripts()", () => {
	it("parses a valid spec into a Script with all fields", async () => {
		const specContent = makeSpec();
		const deps = makeDeps({
			glob: async function* () {
				yield "linux/ubuntu-24.04-x64/install-curl.md";
			},
			readFile: async (p) => {
				if (p.endsWith(".md")) return specContent;
				return "#!/bin/bash\napt-get install -y curl";
			},
		});

		const scripts = await loadScripts(deps);

		expect(scripts).toHaveLength(1);
		const s = scripts[0];
		expect(s.id).toBe("linux/ubuntu-24.04-x64/install-curl");
		expect(s.title).toBe("Install curl");
		expect(s.description).toBe("Installs curl on the system.");
		expect(s.platform).toBe("ubuntu-24.04-x64");
		expect(s.body).toContain("This installs curl");
		expect(s.source).toBe("#!/bin/bash\napt-get install -y curl");
		expect(s.runCommand).toBe(
			"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-curl.sh | bash",
		);
		// Must not have os or arch
		expect("os" in s).toBe(false);
		expect("arch" in s).toBe(false);
	});

	it("sets description to empty string when frontmatter field is absent", async () => {
		const noDescSpec = `---\nplatform: ubuntu-24.04-x64\ntitle: Install curl\n---\n\nBody.\n`;
		const deps = makeDeps({
			glob: async function* () {
				yield "linux/ubuntu-24.04-x64/install-curl.md";
			},
			readFile: async (p) => {
				if (p.endsWith(".md")) return noDescSpec;
				return "#!/bin/bash";
			},
		});

		const scripts = await loadScripts(deps);
		expect(scripts).toHaveLength(1);
		expect(scripts[0].description).toBe("");
	});

	it("skips a spec missing the required title field", async () => {
		const noTitleSpec = `---\nplatform: ubuntu-24.04-x64\n---\n\nBody here.\n`;
		const deps = makeDeps({
			glob: async function* () {
				yield "linux/ubuntu-24.04-x64/bad-script.md";
			},
			readFile: async () => noTitleSpec,
		});

		const scripts = await loadScripts(deps);
		expect(scripts).toHaveLength(0);
	});

	it("skips a spec missing the required platform field and warns", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const noPlatformSpec = `---\ntitle: Some Script\n---\n\nBody.\n`;
		const deps = makeDeps({
			glob: async function* () {
				yield "linux/ubuntu-24.04-x64/some-script.md";
			},
			readFile: async () => noPlatformSpec,
		});

		const scripts = await loadScripts(deps);
		expect(scripts).toHaveLength(0);
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("platform"));
		warnSpy.mockRestore();
	});

	it("sets source to empty string when co-located script file does not exist", async () => {
		const specContent = makeSpec();
		const deps = makeDeps({
			glob: async function* () {
				yield "linux/ubuntu-24.04-x64/install-curl.md";
			},
			readFile: async (p) => {
				if (p.endsWith(".md")) return specContent;
				throw new Error("file not found");
			},
		});

		const scripts = await loadScripts(deps);
		expect(scripts).toHaveLength(1);
		expect(scripts[0].source).toBe("");
	});

	it("sets runCommand to empty string when source file does not exist", async () => {
		const specContent = makeSpec();
		const deps = makeDeps({
			glob: async function* () {
				yield "linux/ubuntu-24.04-x64/install-curl.md";
			},
			readFile: async (p) => {
				if (p.endsWith(".md")) return specContent;
				throw new Error("file not found");
			},
		});

		const scripts = await loadScripts(deps);
		expect(scripts[0].runCommand).toBe("");
	});

	it("buildRunCommand produces correct URL for a known id", async () => {
		const specContent = makeSpec({
			platform: "ubuntu-24.04-x64",
			title: "Install curl",
		});
		const deps = makeDeps({
			glob: async function* () {
				yield "linux/ubuntu-24.04-x64/install-curl.md";
			},
			readFile: async (p) => {
				if (p.endsWith(".md")) return specContent;
				return "#!/bin/bash";
			},
		});

		const scripts = await loadScripts(deps);
		expect(scripts[0].runCommand).toBe(
			"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-curl.sh | bash",
		);
	});

	it("derives a PowerShell run command for .ps1 scripts", async () => {
		const specContent = makeSpec({
			platform: "windows-11-x64",
			title: "Setup winget",
		});
		const deps = makeDeps({
			glob: async function* () {
				yield "windows/windows-11-x64/setup-winget.md";
			},
			readFile: async (p) => {
				if (p.endsWith(".md")) return specContent;
				if (p.endsWith(".ps1")) return "# PowerShell";
				throw new Error("file not found");
			},
		});

		const scripts = await loadScripts(deps);
		expect(scripts[0].runCommand).toBe(
			"irm https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/windows/windows-11-x64/setup-winget.ps1 | iex",
		);
	});

	it("derives the correct mac run command", async () => {
		const specContent = makeSpec({
			platform: "macos-sequoia-arm64",
			title: "Install Homebrew",
		});
		const deps = makeDeps({
			glob: async function* () {
				yield "mac/macos-sequoia-arm64/install-homebrew.md";
			},
			readFile: async (p) => {
				if (p.endsWith(".md")) return specContent;
				return "#!/bin/bash";
			},
		});

		const scripts = await loadScripts(deps);
		expect(scripts[0].runCommand).toBe(
			"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/mac/macos-sequoia-arm64/install-homebrew.sh | bash",
		);
	});

	it("returns scripts sorted by platform then title", async () => {
		const deps = makeDeps({
			glob: async function* () {
				yield "mac/macos-sequoia-arm64/z-script.md";
				yield "linux/ubuntu-24.04-x64/b-script.md";
				yield "linux/ubuntu-24.04-x64/a-script.md";
				yield "windows/windows-11-x64/setup.md";
			},
			readFile: async (p) => {
				if (p.includes("mac/macos-sequoia-arm64/z-script"))
					return `---\nplatform: macos-sequoia-arm64\ntitle: Z Script\n---\nBody.\n`;
				if (p.includes("linux/ubuntu-24.04-x64/b-script"))
					return `---\nplatform: ubuntu-24.04-x64\ntitle: B Script\n---\nBody.\n`;
				if (p.includes("linux/ubuntu-24.04-x64/a-script"))
					return `---\nplatform: ubuntu-24.04-x64\ntitle: A Script\n---\nBody.\n`;
				if (p.includes("windows/windows-11-x64/setup"))
					return `---\nplatform: windows-11-x64\ntitle: Setup\n---\nBody.\n`;
				return "";
			},
		});

		const scripts = await loadScripts(deps);
		expect(scripts).toHaveLength(4);
		// macos-sequoia-arm64 < ubuntu-24.04-x64 < windows-11-x64 (alphabetical)
		expect(scripts[0].platform).toBe("macos-sequoia-arm64");
		expect(scripts[1].platform).toBe("ubuntu-24.04-x64");
		expect(scripts[1].title).toBe("A Script");
		expect(scripts[2].platform).toBe("ubuntu-24.04-x64");
		expect(scripts[2].title).toBe("B Script");
		expect(scripts[3].platform).toBe("windows-11-x64");
	});

	it("returns empty array when no spec files found", async () => {
		const deps = makeDeps({ glob: async function* () {} });
		const scripts = await loadScripts(deps);
		expect(scripts).toHaveLength(0);
	});

	it("continues past a spec with unparseable YAML", async () => {
		const badYamlSpec = `---\n: : invalid yaml :::\n---\nBody.\n`;
		const goodSpec = makeSpec({ title: "Good Script" });
		const deps = makeDeps({
			glob: async function* () {
				yield "linux/ubuntu-24.04-x64/bad.md";
				yield "linux/ubuntu-24.04-x64/good.md";
			},
			readFile: async (p) => {
				if (p.includes("bad.md")) return badYamlSpec;
				return goodSpec;
			},
		});

		const scripts = await loadScripts(deps);
		// bad spec skipped, good one loaded
		expect(scripts).toHaveLength(1);
		expect(scripts[0].title).toBe("Good Script");
	});
});

// ─── Integration tests against scripts-fixture/ ──────────────────────────────

describe("loadScripts() integration — scripts-fixture/ folder", () => {
	it("loads at least 3 scripts total", async () => {
		const scripts = await loadScripts(defaultDeps(fixtureDir));
		expect(scripts.length).toBeGreaterThanOrEqual(3);
	});

	it("every loaded script has a non-empty title and id", async () => {
		const scripts = await loadScripts(defaultDeps(fixtureDir));
		for (const s of scripts) {
			expect(s.title.length).toBeGreaterThan(0);
			expect(s.id.length).toBeGreaterThan(0);
		}
	});

	it("every loaded script has a platform string (combined target)", async () => {
		const scripts = await loadScripts(defaultDeps(fixtureDir));
		for (const s of scripts) {
			expect(typeof s.platform).toBe("string");
			expect(s.platform.length).toBeGreaterThan(0);
		}
	});
});
