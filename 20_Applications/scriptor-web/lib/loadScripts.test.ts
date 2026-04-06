// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { LoadScriptsDeps } from "./loadScripts.js";
import { loadScripts } from "./loadScripts.js";

// Helper to build a minimal spec file string
function makeSpec(overrides: Record<string, string> = {}): string {
	const fm = {
		platform: "linux",
		os: "ubuntu-24.04",
		title: "Install curl",
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
		glob: async () => [],
		readFile: async () => "",
		fileExists: async () => false,
		scriptsDir: "/fake/scripts",
		...overrides,
	};
}

describe("loadScripts()", () => {
	it("parses a valid spec into a Script with all fields", async () => {
		const specContent = makeSpec();
		const deps = makeDeps({
			glob: async () => ["linux/ubuntu-24.04/install-curl.md"],
			readFile: async (p) => {
				if (p.endsWith(".md")) return specContent;
				return "#!/bin/bash\napt-get install -y curl";
			},
			fileExists: async () => true,
		});

		const scripts = await loadScripts(deps);

		expect(scripts).toHaveLength(1);
		const s = scripts[0];
		expect(s.id).toBe("linux/ubuntu-24.04/install-curl");
		expect(s.title).toBe("Install curl");
		expect(s.platform).toBe("linux");
		expect(s.os).toBe("ubuntu-24.04");
		expect(s.body).toContain("This installs curl");
		expect(s.source).toBe("#!/bin/bash\napt-get install -y curl");
		expect(s.runCommand).toBe(
			"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04/install-curl.sh | bash",
		);
	});

	it("skips a spec missing the required title field", async () => {
		// Rebuild without title (note: makeSpec with empty title still emits "title: " which yaml parses as "")
		const noTitleSpec = `---\nplatform: linux\nos: ubuntu-24.04\n---\n\nBody here.\n`;
		const deps = makeDeps({
			glob: async () => ["linux/ubuntu-24.04/bad-script.md"],
			readFile: async () => noTitleSpec,
			fileExists: async () => true,
		});

		const scripts = await loadScripts(deps);
		expect(scripts).toHaveLength(0);
	});

	it("skips a spec missing the required platform field", async () => {
		const noPlatformSpec = `---\nos: ubuntu-24.04\ntitle: Some Script\n---\n\nBody.\n`;
		const deps = makeDeps({
			glob: async () => ["linux/ubuntu-24.04/some-script.md"],
			readFile: async () => noPlatformSpec,
			fileExists: async () => true,
		});

		const scripts = await loadScripts(deps);
		expect(scripts).toHaveLength(0);
	});

	it("skips a spec missing the required os field", async () => {
		const noOsSpec = `---\nplatform: linux\ntitle: Some Script\n---\n\nBody.\n`;
		const deps = makeDeps({
			glob: async () => ["linux/ubuntu-24.04/some-script.md"],
			readFile: async () => noOsSpec,
			fileExists: async () => true,
		});

		const scripts = await loadScripts(deps);
		expect(scripts).toHaveLength(0);
	});

	it("sets source to empty string when co-located script file does not exist", async () => {
		const specContent = makeSpec();
		const deps = makeDeps({
			glob: async () => ["linux/ubuntu-24.04/install-curl.md"],
			readFile: async () => specContent,
			fileExists: async () => false,
		});

		const scripts = await loadScripts(deps);
		expect(scripts).toHaveLength(1);
		expect(scripts[0].source).toBe("");
	});

	it("sets runCommand to empty string when source file does not exist", async () => {
		const specContent = makeSpec();
		const deps = makeDeps({
			glob: async () => ["linux/ubuntu-24.04/install-curl.md"],
			readFile: async () => specContent,
			fileExists: async () => false,
		});

		const scripts = await loadScripts(deps);
		expect(scripts[0].runCommand).toBe("");
	});

	it("parses optional arch field when present", async () => {
		const specContent = makeSpec({ arch: "x64" });
		const deps = makeDeps({
			glob: async () => ["linux/ubuntu-24.04/install-curl.md"],
			readFile: async (p) => {
				if (p.endsWith(".md")) return specContent;
				return "#!/bin/bash";
			},
			fileExists: async () => true,
		});

		const scripts = await loadScripts(deps);
		expect(scripts[0].arch).toBe("x64");
	});

	it("leaves arch undefined when not present in frontmatter (arch-agnostic)", async () => {
		const specContent = makeSpec(); // no arch
		const deps = makeDeps({
			glob: async () => ["linux/ubuntu-24.04/install-curl.md"],
			readFile: async (p) => {
				if (p.endsWith(".md")) return specContent;
				return "#!/bin/bash";
			},
			fileExists: async () => true,
		});

		const scripts = await loadScripts(deps);
		expect(scripts[0].arch).toBeUndefined();
	});

	it("derives the correct windows run command", async () => {
		const specContent = makeSpec({ platform: "windows", os: "windows-11" });
		const deps = makeDeps({
			glob: async () => ["windows/windows-11/setup-winget.md"],
			readFile: async (p) => {
				if (p.endsWith(".md")) return specContent;
				return "# PowerShell";
			},
			fileExists: async () => true,
		});

		const scripts = await loadScripts(deps);
		expect(scripts[0].runCommand).toBe(
			"irm https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/windows/windows-11/setup-winget.ps1 | iex",
		);
	});

	it("derives the correct mac run command", async () => {
		const specContent = makeSpec({ platform: "mac", os: "macos-sequoia" });
		const deps = makeDeps({
			glob: async () => ["mac/macos-sequoia/install-homebrew.md"],
			readFile: async (p) => {
				if (p.endsWith(".md")) return specContent;
				return "#!/bin/bash";
			},
			fileExists: async () => true,
		});

		const scripts = await loadScripts(deps);
		expect(scripts[0].runCommand).toBe(
			"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/mac/macos-sequoia/install-homebrew.sh | bash",
		);
	});

	it("returns scripts sorted by platform, then os, then title", async () => {
		const deps = makeDeps({
			glob: async () => [
				"mac/macos-sequoia/z-script.md",
				"linux/ubuntu-24.04/b-script.md",
				"linux/ubuntu-24.04/a-script.md",
				"windows/windows-11/setup.md",
			],
			readFile: async (p) => {
				if (p.includes("mac/macos-sequoia/z-script"))
					return `---\nplatform: mac\nos: macos-sequoia\ntitle: Z Script\n---\nBody.\n`;
				if (p.includes("linux/ubuntu-24.04/b-script"))
					return `---\nplatform: linux\nos: ubuntu-24.04\ntitle: B Script\n---\nBody.\n`;
				if (p.includes("linux/ubuntu-24.04/a-script"))
					return `---\nplatform: linux\nos: ubuntu-24.04\ntitle: A Script\n---\nBody.\n`;
				if (p.includes("windows/windows-11/setup"))
					return `---\nplatform: windows\nos: windows-11\ntitle: Setup\n---\nBody.\n`;
				return "";
			},
			fileExists: async () => false,
		});

		const scripts = await loadScripts(deps);
		expect(scripts).toHaveLength(4);
		// linux < mac < windows (alphabetical)
		expect(scripts[0].platform).toBe("linux");
		expect(scripts[0].title).toBe("A Script");
		expect(scripts[1].platform).toBe("linux");
		expect(scripts[1].title).toBe("B Script");
		expect(scripts[2].platform).toBe("mac");
		expect(scripts[3].platform).toBe("windows");
	});

	it("returns empty array when no spec files found", async () => {
		const deps = makeDeps({ glob: async () => [] });
		const scripts = await loadScripts(deps);
		expect(scripts).toHaveLength(0);
	});

	it("continues past a spec with unparseable YAML", async () => {
		const badYamlSpec = `---\n: : invalid yaml :::\n---\nBody.\n`;
		const goodSpec = makeSpec({ title: "Good Script" });
		const deps = makeDeps({
			glob: async () => [
				"linux/ubuntu-24.04/bad.md",
				"linux/ubuntu-24.04/good.md",
			],
			readFile: async (p) => {
				if (p.includes("bad.md")) return badYamlSpec;
				return goodSpec;
			},
			fileExists: async () => false,
		});

		const scripts = await loadScripts(deps);
		// bad spec skipped, good one loaded
		expect(scripts).toHaveLength(1);
		expect(scripts[0].title).toBe("Good Script");
	});
});

// ─── Integration tests against real scripts/ folder ──────────────────────────

describe("loadScripts() integration — real scripts/ folder", () => {
	it("loads at least one script per platform (linux, windows, mac)", async () => {
		const scripts = await loadScripts();
		const platforms = new Set(scripts.map((s) => s.platform));
		expect(platforms.has("linux")).toBe(true);
		expect(platforms.has("windows")).toBe(true);
		expect(platforms.has("mac")).toBe(true);
	});

	it("returns at least 3 scripts total", async () => {
		const scripts = await loadScripts();
		expect(scripts.length).toBeGreaterThanOrEqual(3);
	});

	it("every loaded script has a non-empty title and id", async () => {
		const scripts = await loadScripts();
		for (const s of scripts) {
			expect(s.title.length).toBeGreaterThan(0);
			expect(s.id.length).toBeGreaterThan(0);
		}
	});
});
