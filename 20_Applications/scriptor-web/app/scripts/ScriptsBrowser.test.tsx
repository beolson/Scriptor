import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Script } from "../../lib/types.js";
import { ScriptsBrowser } from "./ScriptsBrowser.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ubuntuScript1: Script = {
	id: "linux/ubuntu-24.04-x64/install-curl",
	title: "Install curl",
	description: "Installs curl on Ubuntu.",
	platform: "ubuntu-24.04-x64",
	body: "Installs curl on Ubuntu 24.04 x64.",
	source: "#!/bin/bash\napt-get install -y curl",
	runCommand:
		"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-curl.sh | bash",
};

const ubuntuScript2: Script = {
	id: "linux/ubuntu-24.04-x64/install-git",
	title: "Install git",
	description: "Installs git on Ubuntu.",
	platform: "ubuntu-24.04-x64",
	body: "Installs git on Ubuntu 24.04 x64.",
	source: "#!/bin/bash\napt-get install -y git",
	runCommand:
		"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-git.sh | bash",
};

const windowsScript: Script = {
	id: "windows/windows-11-x64/setup-winget",
	title: "Setup winget",
	description: "Ensures winget is up to date.",
	platform: "windows-11-x64",
	body: "Sets up winget on Windows 11 x64.",
	source: "# PowerShell\nwinget upgrade --all",
	runCommand:
		"irm https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/windows/windows-11-x64/setup-winget.ps1 | iex",
};

const macScript: Script = {
	id: "mac/macos-sequoia-arm64/install-homebrew",
	title: "Install Homebrew",
	description: "Installs Homebrew on macOS.",
	platform: "macos-sequoia-arm64",
	body: "Installs Homebrew on macOS Sequoia ARM64.",
	source: "#!/bin/bash\n/bin/bash -c ...",
	runCommand:
		"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/mac/macos-sequoia-arm64/install-homebrew.sh | bash",
};

const allScripts = [ubuntuScript1, ubuntuScript2, windowsScript, macScript];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ScriptsBrowser", () => {
	it("renders all scripts when no filter is active", () => {
		render(<ScriptsBrowser scripts={allScripts} />);
		expect(screen.getByText("Install curl")).toBeTruthy();
		expect(screen.getByText("Install git")).toBeTruthy();
		expect(screen.getByText("Setup winget")).toBeTruthy();
		expect(screen.getByText("Install Homebrew")).toBeTruthy();
	});

	it("renders one filter button per distinct platform value", () => {
		render(<ScriptsBrowser scripts={allScripts} />);
		// 3 distinct platforms: ubuntu-24.04-x64, windows-11-x64, macos-sequoia-arm64
		// Labels from formatTarget:
		expect(
			screen.getByRole("button", { name: "Ubuntu 24.04 X64" }),
		).toBeTruthy();
		expect(screen.getByRole("button", { name: "Windows 11 X64" })).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Macos Sequoia Arm64" }),
		).toBeTruthy();
	});

	it("clicking a target filter shows only matching scripts", () => {
		render(<ScriptsBrowser scripts={allScripts} />);
		fireEvent.click(screen.getByRole("button", { name: "Ubuntu 24.04 X64" }));
		expect(screen.getByText("Install curl")).toBeTruthy();
		expect(screen.getByText("Install git")).toBeTruthy();
		expect(screen.queryByText("Setup winget")).toBeNull();
		expect(screen.queryByText("Install Homebrew")).toBeNull();
	});

	it("clicking the active target again shows all scripts (deselect)", () => {
		render(<ScriptsBrowser scripts={allScripts} />);
		fireEvent.click(screen.getByRole("button", { name: "Ubuntu 24.04 X64" }));
		expect(screen.queryByText("Setup winget")).toBeNull();
		// Deselect by clicking again
		fireEvent.click(screen.getByRole("button", { name: "Ubuntu 24.04 X64" }));
		expect(screen.getByText("Setup winget")).toBeTruthy();
		expect(screen.getByText("Install Homebrew")).toBeTruthy();
	});

	it("switching to a different target updates the list", () => {
		render(<ScriptsBrowser scripts={allScripts} />);
		fireEvent.click(screen.getByRole("button", { name: "Ubuntu 24.04 X64" }));
		expect(screen.queryByText("Setup winget")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Windows 11 X64" }));
		expect(screen.getByText("Setup winget")).toBeTruthy();
		expect(screen.queryByText("Install curl")).toBeNull();
	});

	it("renders EmptyState when no scripts are provided", () => {
		render(<ScriptsBrowser scripts={[]} />);
		expect(
			screen.getByText("No scripts found for this combination."),
		).toBeTruthy();
	});

	it("each script row links to /scripts/{id}", () => {
		render(<ScriptsBrowser scripts={[ubuntuScript1]} />);
		const link = screen.getByRole("link", { name: "Install curl" });
		expect(link.getAttribute("href")).toBe(
			"/scripts/linux/ubuntu-24.04-x64/install-curl",
		);
	});

	it("filter buttons derive labels from formatTarget", () => {
		const singleScript: Script = {
			id: "linux/debian-13-x64/install-neovim",
			title: "Install Neovim",
			description: "Installs Neovim on Debian.",
			platform: "debian-13-x64",
			body: "Installs Neovim.",
			source: "#!/bin/bash",
			runCommand: "curl -fsSL https://example.com | bash",
		};
		render(<ScriptsBrowser scripts={[singleScript]} />);
		expect(screen.getByRole("button", { name: "Debian 13 X64" })).toBeTruthy();
	});
});
