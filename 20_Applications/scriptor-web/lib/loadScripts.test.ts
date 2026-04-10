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

// Helper to build a .sh script with an embedded spec block
function makeShSpec(
	overrides: Partial<Record<"platform" | "title" | "description", string>> = {},
): string {
	const fm = {
		platform: "ubuntu-24.04-x64",
		title: "Install curl",
		description: "Installs curl on the system.",
		...overrides,
	};
	const fmLines = Object.entries(fm)
		.map(([k, v]) => `# ${k}: ${v}`)
		.join("\n");
	return `#!/bin/bash\n# ---\n${fmLines}\n# ---\n#\n# This installs curl on the system.\n\napt-get install -y curl\n`;
}

// Helper to build a .ps1 script with an embedded spec block
function makePs1Spec(
	overrides: Partial<Record<"platform" | "title" | "description", string>> = {},
): string {
	const fm = {
		platform: "ubuntu-24.04-x64",
		title: "Install curl",
		description: "Installs curl on the system.",
		...overrides,
	};
	const yamlLines = Object.entries(fm)
		.map(([k, v]) => `${k}: ${v}`)
		.join("\n");
	return `<#\n---\n${yamlLines}\n---\n\nThis installs curl on the system.\n#>\n\nWrite-Output "test"\n`;
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
		const scriptContent = makeShSpec();
		const deps = makeDeps({
			glob: async function* () {
				yield "linux/ubuntu-24.04-x64/install-curl.sh";
			},
			readFile: async () => scriptContent,
		});

		const scripts = await loadScripts(deps);

		expect(scripts).toHaveLength(1);
		const s = scripts[0];
		expect(s.id).toBe("linux/ubuntu-24.04-x64/install-curl");
		expect(s.title).toBe("Install curl");
		expect(s.description).toBe("Installs curl on the system.");
		expect(s.platform).toBe("ubuntu-24.04-x64");
		expect(s.body).toContain("This installs curl");
		expect(s.source).toBe(scriptContent);
		expect(s.runCommand).toBe(
			"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-curl.sh | bash",
		);
		// Must not have os or arch
		expect("os" in s).toBe(false);
		expect("arch" in s).toBe(false);
	});

	it("sets description to empty string when frontmatter field is absent", async () => {
		const noDescScript =
			"#!/bin/bash\n# ---\n# platform: ubuntu-24.04-x64\n# title: Install curl\n# ---\n#\n# Body.\n\napt-get install -y curl\n";
		const deps = makeDeps({
			glob: async function* () {
				yield "linux/ubuntu-24.04-x64/install-curl.sh";
			},
			readFile: async () => noDescScript,
		});

		const scripts = await loadScripts(deps);
		expect(scripts).toHaveLength(1);
		expect(scripts[0].description).toBe("");
	});

	it("skips a spec missing the required title field", async () => {
		const noTitleScript =
			"#!/bin/bash\n# ---\n# platform: ubuntu-24.04-x64\n# ---\n#\n# Body here.\n\necho hi\n";
		const deps = makeDeps({
			glob: async function* () {
				yield "linux/ubuntu-24.04-x64/bad-script.sh";
			},
			readFile: async () => noTitleScript,
		});

		const scripts = await loadScripts(deps);
		expect(scripts).toHaveLength(0);
	});

	it("skips a spec missing the required platform field and warns", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const noPlatformScript =
			"#!/bin/bash\n# ---\n# title: Some Script\n# ---\n#\n# Body.\n\necho hi\n";
		const deps = makeDeps({
			glob: async function* () {
				yield "linux/ubuntu-24.04-x64/some-script.sh";
			},
			readFile: async () => noPlatformScript,
		});

		const scripts = await loadScripts(deps);
		expect(scripts).toHaveLength(0);
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("platform"));
		warnSpy.mockRestore();
	});

	it("skips a script with no embedded spec block", async () => {
		const deps = makeDeps({
			glob: async function* () {
				yield "linux/ubuntu-24.04-x64/bare-script.sh";
			},
			readFile: async () => "#!/bin/bash\napt-get install -y curl\n",
		});

		const scripts = await loadScripts(deps);
		expect(scripts).toHaveLength(0);
	});

	it("buildRunCommand produces correct URL for a known id", async () => {
		const scriptContent = makeShSpec({
			platform: "ubuntu-24.04-x64",
			title: "Install curl",
		});
		const deps = makeDeps({
			glob: async function* () {
				yield "linux/ubuntu-24.04-x64/install-curl.sh";
			},
			readFile: async () => scriptContent,
		});

		const scripts = await loadScripts(deps);
		expect(scripts[0].runCommand).toBe(
			"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-curl.sh | bash",
		);
	});

	it("derives a PowerShell run command for .ps1 scripts", async () => {
		const scriptContent = makePs1Spec({
			platform: "windows-11-x64",
			title: "Setup winget",
		});
		const deps = makeDeps({
			glob: async function* () {
				yield "windows/windows-11-x64/setup-winget.ps1";
			},
			readFile: async () => scriptContent,
		});

		const scripts = await loadScripts(deps);
		expect(scripts[0].runCommand).toBe(
			"irm https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/windows/windows-11-x64/setup-winget.ps1 | iex",
		);
	});

	it("derives the correct mac run command", async () => {
		const scriptContent = makeShSpec({
			platform: "macos-sequoia-arm64",
			title: "Install Homebrew",
		});
		const deps = makeDeps({
			glob: async function* () {
				yield "mac/macos-sequoia-arm64/install-homebrew.sh";
			},
			readFile: async () => scriptContent,
		});

		const scripts = await loadScripts(deps);
		expect(scripts[0].runCommand).toBe(
			"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/mac/macos-sequoia-arm64/install-homebrew.sh | bash",
		);
	});

	it("returns scripts sorted by platform then title", async () => {
		const deps = makeDeps({
			glob: async function* () {
				yield "mac/macos-sequoia-arm64/z-script.sh";
				yield "linux/ubuntu-24.04-x64/b-script.sh";
				yield "linux/ubuntu-24.04-x64/a-script.sh";
				yield "windows/windows-11-x64/setup.ps1";
			},
			readFile: async (p) => {
				if (p.includes("mac/macos-sequoia-arm64/z-script"))
					return makeShSpec({
						platform: "macos-sequoia-arm64",
						title: "Z Script",
					});
				if (p.includes("linux/ubuntu-24.04-x64/b-script"))
					return makeShSpec({
						platform: "ubuntu-24.04-x64",
						title: "B Script",
					});
				if (p.includes("linux/ubuntu-24.04-x64/a-script"))
					return makeShSpec({
						platform: "ubuntu-24.04-x64",
						title: "A Script",
					});
				if (p.includes("windows/windows-11-x64/setup"))
					return makePs1Spec({ platform: "windows-11-x64", title: "Setup" });
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

	it("returns empty array when no script files found", async () => {
		const deps = makeDeps({ glob: async function* () {} });
		const scripts = await loadScripts(deps);
		expect(scripts).toHaveLength(0);
	});

	it("continues past a spec with unparseable YAML", async () => {
		const badYamlScript =
			"#!/bin/bash\n# ---\n# : : invalid yaml :::\n# ---\n# Body.\n\necho bad\n";
		const goodScript = makeShSpec({ title: "Good Script" });
		const deps = makeDeps({
			glob: async function* () {
				yield "linux/ubuntu-24.04-x64/bad.sh";
				yield "linux/ubuntu-24.04-x64/good.sh";
			},
			readFile: async (p) => {
				if (p.includes("bad.sh")) return badYamlScript;
				return goodScript;
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
