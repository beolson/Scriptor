import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Script } from "../../lib/types.js";
import { ScriptsBrowser } from "./ScriptsBrowser.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const linuxScript1: Script = {
	id: "linux/ubuntu-24.04/install-curl",
	title: "Install curl",
	platform: "linux",
	os: "ubuntu-24.04",
	body: "Installs curl on Ubuntu 24.04.",
	source: "#!/bin/bash\napt-get install -y curl",
	runCommand:
		"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04/install-curl.sh | bash",
};

const linuxScript2: Script = {
	id: "linux/ubuntu-24.04/install-git",
	title: "Install git",
	platform: "linux",
	os: "ubuntu-24.04",
	body: "Installs git on Ubuntu 24.04.",
	source: "#!/bin/bash\napt-get install -y git",
	runCommand:
		"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04/install-git.sh | bash",
};

const windowsScript: Script = {
	id: "windows/windows-11/setup-winget",
	title: "Setup winget",
	platform: "windows",
	os: "windows-11",
	body: "Sets up winget on Windows 11.",
	source: "# PowerShell\nwinget upgrade --all",
	runCommand:
		"irm https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/windows/windows-11/setup-winget.ps1 | iex",
};

const macScript: Script = {
	id: "mac/macos-sequoia/install-homebrew",
	title: "Install Homebrew",
	platform: "mac",
	os: "macos-sequoia",
	body: "Installs Homebrew on macOS Sequoia.",
	source: "#!/bin/bash\n/bin/bash -c ...",
	runCommand:
		"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/mac/macos-sequoia/install-homebrew.sh | bash",
};

const allScripts = [linuxScript1, linuxScript2, windowsScript, macScript];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ScriptsBrowser", () => {
	it("renders all scripts when no filter is active", () => {
		render(<ScriptsBrowser scripts={allScripts} />);
		expect(screen.getByText("Install curl")).toBeTruthy();
		expect(screen.getByText("Install git")).toBeTruthy();
		expect(screen.getByText("Setup winget")).toBeTruthy();
		expect(screen.getByText("Install Homebrew")).toBeTruthy();
	});

	it("renders filter buttons for each platform present in scripts", () => {
		render(<ScriptsBrowser scripts={allScripts} />);
		// All three platforms are in our fixture data
		expect(screen.getByRole("button", { name: "Linux" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Windows" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "macOS" })).toBeTruthy();
	});

	it("selecting a platform filter narrows the list to matching scripts only", () => {
		render(<ScriptsBrowser scripts={allScripts} />);
		fireEvent.click(screen.getByRole("button", { name: "Linux" }));
		expect(screen.getByText("Install curl")).toBeTruthy();
		expect(screen.getByText("Install git")).toBeTruthy();
		// Non-linux scripts should not appear
		expect(screen.queryByText("Setup winget")).toBeNull();
		expect(screen.queryByText("Install Homebrew")).toBeNull();
	});

	it("deselecting the active platform filter restores the full list", () => {
		render(<ScriptsBrowser scripts={allScripts} />);
		// Select Linux
		fireEvent.click(screen.getByRole("button", { name: "Linux" }));
		expect(screen.queryByText("Setup winget")).toBeNull();
		// Deselect Linux by clicking again
		fireEvent.click(screen.getByRole("button", { name: "Linux" }));
		expect(screen.getByText("Setup winget")).toBeTruthy();
		expect(screen.getByText("Install Homebrew")).toBeTruthy();
	});

	it("renders EmptyState when no scripts are provided", () => {
		render(<ScriptsBrowser scripts={[]} />);
		expect(
			screen.getByText("No scripts found for this combination."),
		).toBeTruthy();
	});

	it("a platform filter button is disabled when selecting it would yield zero results given other active filters", () => {
		// linux has ubuntu-24.04, windows has windows-11.
		// If we select linux then ubuntu-24.04 OS filter, the windows button
		// should be disabled (no windows script has os=ubuntu-24.04).
		render(<ScriptsBrowser scripts={[linuxScript1, windowsScript]} />);
		// Select linux platform
		fireEvent.click(screen.getByRole("button", { name: "Linux" }));
		// Select ubuntu-24.04 OS filter
		fireEvent.click(screen.getByRole("button", { name: "ubuntu-24.04" }));
		// Now deselect linux to see platform row again — but with os=ubuntu-24.04 still active
		fireEvent.click(screen.getByRole("button", { name: "Linux" }));
		// Windows button should be disabled since no windows script has os=ubuntu-24.04
		const windowsBtn = screen.getByRole("button", { name: "Windows" });
		expect(windowsBtn.getAttribute("aria-disabled")).toBe("true");
	});

	it("an enabled platform filter button is not aria-disabled", () => {
		render(<ScriptsBrowser scripts={allScripts} />);
		const linuxBtn = screen.getByRole("button", { name: "Linux" });
		expect(linuxBtn.getAttribute("aria-disabled")).toBeNull();
	});

	it("OS filter buttons appear after selecting a platform", () => {
		render(<ScriptsBrowser scripts={allScripts} />);
		fireEvent.click(screen.getByRole("button", { name: "Linux" }));
		// ubuntu-24.04 appears as an OS filter button
		expect(screen.getByRole("button", { name: "ubuntu-24.04" })).toBeTruthy();
	});

	it("selecting an OS filter narrows list further", () => {
		const linuxDebian: Script = {
			id: "linux/debian-12/install-curl",
			title: "Install curl (Debian)",
			platform: "linux",
			os: "debian-12",
			body: "Body.",
			source: "#!/bin/bash\napt-get install -y curl",
			runCommand:
				"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/debian-12/install-curl.sh | bash",
		};
		const scripts = [linuxScript1, linuxScript2, linuxDebian, windowsScript];
		render(<ScriptsBrowser scripts={scripts} />);
		fireEvent.click(screen.getByRole("button", { name: "Linux" }));
		fireEvent.click(screen.getByRole("button", { name: "ubuntu-24.04" }));
		expect(screen.getByText("Install curl")).toBeTruthy();
		expect(screen.getByText("Install git")).toBeTruthy();
		expect(screen.queryByText("Install curl (Debian)")).toBeNull();
	});

	it("each script row links to /scripts/{id}", () => {
		render(<ScriptsBrowser scripts={[linuxScript1]} />);
		const link = screen.getByRole("link", { name: "Install curl" });
		expect(link.getAttribute("href")).toBe(
			"/scripts/linux/ubuntu-24.04/install-curl",
		);
	});
});
