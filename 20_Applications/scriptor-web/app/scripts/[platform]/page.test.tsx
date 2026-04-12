import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GroupEntry } from "../../../lib/loadGroups.js";
import type { PlatformEntry } from "../../../lib/loadPlatforms.js";
import type { Script } from "../../../lib/types.js";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../../lib/loadScripts.js", () => ({
	loadScripts: vi.fn(),
}));

vi.mock("../../../lib/loadGroups.js", () => ({
	loadGroups: vi.fn(),
}));

vi.mock("../../../lib/loadPlatforms.js", () => ({
	loadPlatforms: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	notFound: vi.fn(() => {
		throw new Error("NEXT_NOT_FOUND");
	}),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const fixturePlatformEntry: PlatformEntry = {
	displayName: "Debian 13 x64",
	installCommand: "$ curl -fsSL https://scriptor.dev/install.sh | sh",
	codeLabel: "// bash",
};

const fixtureGroup: GroupEntry = {
	id: "debian-13-dev-setup",
	name: "Debian 13 Dev Setup",
	description: "Installs Bun, Go, and .NET on a fresh Debian 13 machine.",
};

function makeScript(overrides: Partial<Script> = {}): Script {
	return {
		id: "linux/debian-13-x64/install-bun",
		title: "Install Bun",
		description: "Installs the Bun JavaScript runtime.",
		platform: "debian-13-x64",
		body: "Installs Bun.",
		source: "#!/bin/bash\ncurl -fsSL https://bun.sh/install | bash",
		runCommand:
			"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/debian-13-x64/install-bun.sh | bash",
		...overrides,
	};
}

const groupedScript1 = makeScript({
	id: "linux/debian-13-x64/install-bun",
	title: "Install Bun",
	group: "debian-13-dev-setup",
	groupOrder: 1,
});

const groupedScript2 = makeScript({
	id: "linux/debian-13-x64/install-go",
	title: "Install Go",
	description: "Installs the Go programming language.",
	group: "debian-13-dev-setup",
	groupOrder: 2,
});

const ungroupedScript1 = makeScript({
	id: "linux/debian-13-x64/install-curl",
	title: "Install curl",
	description: "Installs curl on Debian.",
});

const ungroupedScript2 = makeScript({
	id: "linux/debian-13-x64/install-git",
	title: "Install git",
	description: "Installs git on Debian.",
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function importPage() {
	const mod = await import("./page.js");
	return mod;
}

function makeParams(platform = "debian-13-x64") {
	return { params: Promise.resolve({ platform }) };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Platform browse page", () => {
	it("renders a GroupRow for each group with members before ungrouped ScriptRows", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		const { loadPlatforms } = await import("../../../lib/loadPlatforms.js");
		vi.mocked(loadPlatforms).mockResolvedValue({
			"debian-13-x64": fixturePlatformEntry,
		});
		vi.mocked(loadScripts).mockResolvedValue([
			groupedScript1,
			groupedScript2,
			ungroupedScript1,
		]);
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(await Page(makeParams()));
		});

		expect(screen.getByText("Debian 13 Dev Setup")).toBeTruthy();
		expect(screen.getByText("Install curl")).toBeTruthy();
	});

	it("group entries appear before ungrouped script entries in DOM order", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		const { loadPlatforms } = await import("../../../lib/loadPlatforms.js");
		vi.mocked(loadPlatforms).mockResolvedValue({
			"debian-13-x64": fixturePlatformEntry,
		});
		vi.mocked(loadScripts).mockResolvedValue([
			groupedScript1,
			groupedScript2,
			ungroupedScript1,
		]);
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(await Page(makeParams()));
		});

		const allLinks = screen.getAllByRole("link");
		const groupNameLinkIndex = allLinks.findIndex(
			(l) => l.textContent === "Debian 13 Dev Setup",
		);
		const ungroupedScriptLinkIndex = allLinks.findIndex(
			(l) => l.textContent === "Install curl",
		);
		expect(groupNameLinkIndex).toBeLessThan(ungroupedScriptLinkIndex);
	});

	it("renders group badge for group entries", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		const { loadPlatforms } = await import("../../../lib/loadPlatforms.js");
		vi.mocked(loadPlatforms).mockResolvedValue({
			"debian-13-x64": fixturePlatformEntry,
		});
		vi.mocked(loadScripts).mockResolvedValue([groupedScript1, groupedScript2]);
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(await Page(makeParams()));
		});

		expect(screen.getByTestId("group-badge")).toBeTruthy();
	});

	it("scripts belonging to a group are not in the ungrouped section", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		const { loadPlatforms } = await import("../../../lib/loadPlatforms.js");
		vi.mocked(loadPlatforms).mockResolvedValue({
			"debian-13-x64": fixturePlatformEntry,
		});
		vi.mocked(loadScripts).mockResolvedValue([
			groupedScript1,
			groupedScript2,
			ungroupedScript1,
		]);
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(await Page(makeParams()));
		});

		expect(screen.queryByRole("link", { name: "Install Bun" })).toBeNull();
		expect(screen.queryByRole("link", { name: "Install Go" })).toBeNull();
	});

	it("ungrouped scripts appear when no groups exist on the page", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		const { loadPlatforms } = await import("../../../lib/loadPlatforms.js");
		vi.mocked(loadPlatforms).mockResolvedValue({
			"debian-13-x64": fixturePlatformEntry,
		});
		vi.mocked(loadScripts).mockResolvedValue([
			ungroupedScript1,
			ungroupedScript2,
		]);
		vi.mocked(loadGroups).mockResolvedValue([]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(await Page(makeParams()));
		});

		expect(screen.getByText("Install curl")).toBeTruthy();
		expect(screen.getByText("Install git")).toBeTruthy();
		expect(screen.queryByTestId("group-badge")).toBeNull();
	});

	it("shows correct script count including grouped and ungrouped scripts", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		const { loadPlatforms } = await import("../../../lib/loadPlatforms.js");
		vi.mocked(loadPlatforms).mockResolvedValue({
			"debian-13-x64": fixturePlatformEntry,
		});
		vi.mocked(loadScripts).mockResolvedValue([
			groupedScript1,
			groupedScript2,
			ungroupedScript1,
		]);
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(await Page(makeParams()));
		});

		expect(screen.getByText(/3 scripts available/)).toBeTruthy();
	});

	it("renders the platform display name in the heading", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		const { loadPlatforms } = await import("../../../lib/loadPlatforms.js");
		vi.mocked(loadPlatforms).mockResolvedValue({
			"debian-13-x64": fixturePlatformEntry,
		});
		vi.mocked(loadScripts).mockResolvedValue([ungroupedScript1]);
		vi.mocked(loadGroups).mockResolvedValue([]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(await Page(makeParams()));
		});

		expect(screen.getByRole("heading").textContent).toContain("Debian 13 x64");
	});
});
