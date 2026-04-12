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
	id: "linux-dev-setup",
	name: "Linux Dev Setup",
	description: "Installs Bun, Go, and .NET on a fresh Linux machine.",
};

function makeLinuxScript(overrides: Partial<Script> = {}): Script {
	return {
		id: "linux/ubuntu-24.04-x64/install-bun",
		title: "Install Bun",
		description: "Installs the Bun JavaScript runtime.",
		platform: "ubuntu-24.04-x64",
		body: "Installs Bun.",
		source: "#!/bin/bash\ncurl -fsSL https://bun.sh/install | bash",
		runCommand:
			"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-bun.sh | bash",
		...overrides,
	};
}

const groupedScript1 = makeLinuxScript({
	id: "linux/ubuntu-24.04-x64/install-bun",
	title: "Install Bun",
	group: "linux-dev-setup",
	groupOrder: 1,
});

const groupedScript2 = makeLinuxScript({
	id: "linux/ubuntu-24.04-x64/install-go",
	title: "Install Go",
	description: "Installs the Go programming language.",
	group: "linux-dev-setup",
	groupOrder: 2,
});

const ungroupedScript1 = makeLinuxScript({
	id: "linux/ubuntu-24.04-x64/install-curl",
	title: "Install curl",
	description: "Installs curl on Ubuntu.",
});

const ungroupedScript2 = makeLinuxScript({
	id: "linux/ubuntu-24.04-x64/install-git",
	title: "Install git",
	description: "Installs git on Ubuntu.",
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function importPage() {
	const mod = await import("./page.js");
	return mod;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Linux browse page", () => {
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
		expect(screen.getByText("Linux Dev Setup")).toBeTruthy();
		// Ungrouped script should also appear
		expect(screen.getByText("Install curl")).toBeTruthy();
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

		// Get all links; group name link should come before ungrouped script link
		const allLinks = screen.getAllByRole("link");
		const groupNameLinkIndex = allLinks.findIndex(
			(l) => l.textContent === "Linux Dev Setup",
		);
		const ungroupedScriptLinkIndex = allLinks.findIndex(
			(l) => l.textContent === "Install curl",
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

		// groupedScript1 and groupedScript2 should NOT appear in the ungrouped section.
		// They should only appear when the GroupRow is expanded.
		// In the collapsed state, "Install Bun" and "Install Go" titles should not be visible.
		expect(screen.queryByRole("link", { name: "Install Bun" })).toBeNull();
		expect(screen.queryByRole("link", { name: "Install Go" })).toBeNull();
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

		expect(screen.getByText("Install curl")).toBeTruthy();
		expect(screen.getByText("Install git")).toBeTruthy();
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

		// The page still shows a count of all scripts
		expect(screen.getByText(/3 scripts available/)).toBeTruthy();
	});
});
