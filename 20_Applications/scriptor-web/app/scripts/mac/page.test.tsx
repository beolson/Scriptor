import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GroupEntry } from "../../../lib/loadGroups.js";
import type { Script } from "../../../lib/types.js";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../../lib/loadScripts.js", () => ({
	loadScripts: vi.fn(),
}));

vi.mock("../../../lib/loadGroups.js", () => ({
	loadGroups: vi.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const fixtureGroup: GroupEntry = {
	id: "mac-dev-setup",
	name: "Mac Dev Setup",
	description: "Sets up a macOS development machine.",
};

function makeMacScript(overrides: Partial<Script> = {}): Script {
	return {
		id: "mac/macos-sequoia-arm64/install-homebrew",
		title: "Install Homebrew",
		description: "Installs Homebrew on macOS.",
		platform: "macos-sequoia-arm64",
		body: "Installs Homebrew on macOS Sequoia ARM64.",
		source: "#!/bin/bash\n/bin/bash -c ...",
		runCommand:
			"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/mac/macos-sequoia-arm64/install-homebrew.sh | bash",
		...overrides,
	};
}

const groupedScript1 = makeMacScript({
	id: "mac/macos-sequoia-arm64/install-homebrew",
	title: "Install Homebrew",
	group: "mac-dev-setup",
	groupOrder: 1,
});

const groupedScript2 = makeMacScript({
	id: "mac/macos-sequoia-arm64/install-git",
	title: "Install git",
	description: "Installs git on macOS.",
	group: "mac-dev-setup",
	groupOrder: 2,
});

const ungroupedScript1 = makeMacScript({
	id: "mac/macos-sequoia-arm64/install-vscode",
	title: "Install VS Code",
	description: "Installs Visual Studio Code on macOS.",
});

const ungroupedScript2 = makeMacScript({
	id: "mac/macos-sequoia-arm64/install-node",
	title: "Install Node",
	description: "Installs Node.js on macOS.",
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function importPage() {
	const mod = await import("./page.js");
	return mod;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Mac browse page", () => {
	it("renders a GroupRow for each group with members before ungrouped ScriptRows", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		vi.mocked(loadScripts).mockResolvedValue([
			groupedScript1,
			groupedScript2,
			ungroupedScript1,
		]);
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(await Page());
		});

		// Group name should appear
		expect(screen.getByText("Mac Dev Setup")).toBeTruthy();
		// Ungrouped script should also appear
		expect(screen.getByText("Install VS Code")).toBeTruthy();
	});

	it("group entries appear before ungrouped script entries in DOM order", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		vi.mocked(loadScripts).mockResolvedValue([
			groupedScript1,
			groupedScript2,
			ungroupedScript1,
		]);
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(await Page());
		});

		const allLinks = screen.getAllByRole("link");
		const groupNameLinkIndex = allLinks.findIndex(
			(l) => l.textContent === "Mac Dev Setup",
		);
		const ungroupedScriptLinkIndex = allLinks.findIndex(
			(l) => l.textContent === "Install VS Code",
		);
		expect(groupNameLinkIndex).toBeLessThan(ungroupedScriptLinkIndex);
	});

	it("renders group badge for group entries", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		vi.mocked(loadScripts).mockResolvedValue([groupedScript1, groupedScript2]);
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(await Page());
		});

		expect(screen.getByTestId("group-badge")).toBeTruthy();
	});

	it("scripts belonging to a group are not in the ungrouped section", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		vi.mocked(loadScripts).mockResolvedValue([
			groupedScript1,
			groupedScript2,
			ungroupedScript1,
		]);
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(await Page());
		});

		// In collapsed state, grouped script titles should not be visible as links
		expect(screen.queryByRole("link", { name: "Install Homebrew" })).toBeNull();
		expect(screen.queryByRole("link", { name: "Install git" })).toBeNull();
	});

	it("ungrouped scripts appear when no groups exist on the page", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		vi.mocked(loadScripts).mockResolvedValue([
			ungroupedScript1,
			ungroupedScript2,
		]);
		vi.mocked(loadGroups).mockResolvedValue([]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(await Page());
		});

		expect(screen.getByText("Install VS Code")).toBeTruthy();
		expect(screen.getByText("Install Node")).toBeTruthy();
		// No group badge should appear
		expect(screen.queryByTestId("group-badge")).toBeNull();
	});

	it("shows correct script count including grouped and ungrouped scripts", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		vi.mocked(loadScripts).mockResolvedValue([
			groupedScript1,
			groupedScript2,
			ungroupedScript1,
		]);
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(await Page());
		});

		expect(screen.getByText(/3 scripts available/)).toBeTruthy();
	});
});
