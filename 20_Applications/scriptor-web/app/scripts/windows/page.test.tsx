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
	id: "windows-dev-setup",
	name: "Windows Dev Setup",
	description: "Sets up a Windows development machine.",
};

function makeWindowsScript(overrides: Partial<Script> = {}): Script {
	return {
		id: "windows/windows-11-x64/setup-winget",
		title: "Setup winget",
		description: "Ensures winget is up to date.",
		platform: "windows-11-x64",
		body: "Sets up winget on Windows 11 x64.",
		source: "# PowerShell\nwinget upgrade --all",
		runCommand:
			"irm https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/windows/windows-11-x64/setup-winget.ps1 | iex",
		...overrides,
	};
}

const groupedScript1 = makeWindowsScript({
	id: "windows/windows-11-x64/setup-winget",
	title: "Setup winget",
	group: "windows-dev-setup",
	groupOrder: 1,
});

const groupedScript2 = makeWindowsScript({
	id: "windows/windows-11-x64/install-git",
	title: "Install git",
	description: "Installs git on Windows.",
	group: "windows-dev-setup",
	groupOrder: 2,
});

const ungroupedScript1 = makeWindowsScript({
	id: "windows/windows-11-x64/install-vscode",
	title: "Install VS Code",
	description: "Installs Visual Studio Code.",
});

const ungroupedScript2 = makeWindowsScript({
	id: "windows/windows-11-x64/install-node",
	title: "Install Node",
	description: "Installs Node.js.",
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function importPage() {
	const mod = await import("./page.js");
	return mod;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Windows browse page", () => {
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
		expect(screen.getByText("Windows Dev Setup")).toBeTruthy();
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
			(l) => l.textContent === "Windows Dev Setup",
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
		expect(screen.queryByRole("link", { name: "Setup winget" })).toBeNull();
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
