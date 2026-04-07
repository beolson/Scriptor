import { describe, expect, it } from "vitest";
import type { Arch, Platform, Script } from "./types.js";

describe("Platform type", () => {
	it("accepts all valid platform values", () => {
		const platforms: Platform[] = ["linux", "windows", "mac"];
		expect(platforms).toHaveLength(3);
	});
});

describe("Arch type", () => {
	it("accepts all valid arch values", () => {
		const arches: Arch[] = ["x64", "arm64"];
		expect(arches).toHaveLength(2);
	});
});

describe("Script interface", () => {
	it("accepts a complete Script object", () => {
		const script: Script = {
			id: "linux/ubuntu-24.04/install-docker",
			title: "Install Docker",
			platform: "linux",
			os: "ubuntu-24.04",
			arch: "x64",
			body: "## Description\n\nInstalls Docker.",
			source: "#!/bin/bash\napt-get install -y docker.io",
			runCommand:
				"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04/install-docker.sh | bash",
		};
		expect(script.id).toBe("linux/ubuntu-24.04/install-docker");
		expect(script.platform).toBe("linux");
		expect(script.arch).toBe("x64");
	});

	it("accepts a Script object without arch (arch-agnostic)", () => {
		const script: Script = {
			id: "linux/ubuntu-24.04/install-curl",
			title: "Install curl",
			platform: "linux",
			os: "ubuntu-24.04",
			body: "Installs curl.",
			source: "#!/bin/bash\napt-get install -y curl",
			runCommand: "curl -fsSL https://example.com | bash",
		};
		expect(script.arch).toBeUndefined();
	});
});
