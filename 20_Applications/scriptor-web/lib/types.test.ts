import { describe, expect, it } from "vitest";
import type { Script } from "./types.js";

describe("Script interface", () => {
	it("accepts a complete Script object with platform as string", () => {
		const script: Script = {
			id: "linux/ubuntu-24.04-x64/install-docker",
			title: "Install Docker",
			description: "Installs Docker Engine on Ubuntu.",
			platform: "ubuntu-24.04-x64",
			body: "## Description\n\nInstalls Docker.",
			source: "#!/bin/bash\napt-get install -y docker.io",
			runCommand:
				"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-docker.sh | bash",
		};
		expect(script.id).toBe("linux/ubuntu-24.04-x64/install-docker");
		expect(script.platform).toBe("ubuntu-24.04-x64");
		expect(typeof script.platform).toBe("string");
	});

	it("platform field is a string (not a union type constraint)", () => {
		const script: Script = {
			id: "mac/macos-tahoe-arm64/install-homebrew",
			title: "Install Homebrew",
			description: "Installs Homebrew on macOS.",
			platform: "macos-tahoe-arm64",
			body: "Installs Homebrew.",
			source: "#!/bin/bash",
			runCommand: "curl -fsSL https://example.com | bash",
		};
		expect(typeof script.platform).toBe("string");
	});

	it("Script does not require os or arch fields", () => {
		// TypeScript compile check: this must not error with os/arch
		const script: Script = {
			id: "windows/windows-11-x64/setup-winget",
			title: "Setup winget",
			description: "Ensures winget is up to date.",
			platform: "windows-11-x64",
			body: "Sets up winget.",
			source: "# PowerShell",
			runCommand: "iwr https://example.com | iex",
		};
		// Verify no os/arch properties exist
		expect("os" in script).toBe(false);
		expect("arch" in script).toBe(false);
	});
});
