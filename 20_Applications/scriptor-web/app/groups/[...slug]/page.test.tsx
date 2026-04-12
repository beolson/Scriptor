import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GroupEntry } from "../../../lib/loadGroups.js";
import type { Script } from "../../../lib/types.js";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../../lib/loadGroups.js", () => ({
	loadGroups: vi.fn(),
}));

vi.mock("../../../lib/loadScripts.js", () => ({
	loadScripts: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	notFound: vi.fn(() => {
		throw new Error("NEXT_NOT_FOUND");
	}),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const fixtureGroup: GroupEntry = {
	id: "linux-dev-setup",
	name: "Linux Dev Setup",
	description:
		"Installs Bun, Go, .NET, and GitHub CLI on a fresh Linux machine.",
};

function makeScript(overrides: Partial<Script> = {}): Script {
	return {
		id: "linux/ubuntu-24.04-x64/install-bun",
		title: "Install Bun",
		description: "Installs the Bun JavaScript runtime.",
		platform: "ubuntu-24.04-x64",
		body: "## Install Bun\n\nInstalls Bun.",
		source: "#!/bin/bash\ncurl -fsSL https://bun.sh/install | bash",
		runCommand:
			"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-bun.sh | bash",
		group: "linux-dev-setup",
		groupOrder: 1,
		...overrides,
	};
}

const memberOne = makeScript({
	id: "linux/ubuntu-24.04-x64/install-bun",
	title: "Install Bun",
	description: "Installs the Bun JavaScript runtime.",
	groupOrder: 1,
});

const memberTwo = makeScript({
	id: "linux/ubuntu-24.04-x64/install-go",
	title: "Install Go",
	description: "Installs the Go programming language.",
	runCommand:
		"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-go.sh | bash",
	groupOrder: 2,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function importPage() {
	const mod = await import("./page.js");
	return mod;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Group detail page — /groups/[...slug]", () => {
	it("renders the group title in an h1", async () => {
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);
		vi.mocked(loadScripts).mockResolvedValue([memberOne, memberTwo]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({ slug: ["linux", "linux-dev-setup"] }),
				}),
			);
		});

		const heading = screen.getByRole("heading", { level: 1 });
		expect(heading).toBeTruthy();
		expect(heading.textContent).toContain("Linux Dev Setup");
	});

	it("renders the group description", async () => {
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);
		vi.mocked(loadScripts).mockResolvedValue([memberOne, memberTwo]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({ slug: ["linux", "linux-dev-setup"] }),
				}),
			);
		});

		expect(
			screen.getByText(
				"Installs Bun, Go, .NET, and GitHub CLI on a fresh Linux machine.",
			),
		).toBeTruthy();
	});

	it("renders platform information derived from member scripts", async () => {
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);
		vi.mocked(loadScripts).mockResolvedValue([memberOne, memberTwo]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({ slug: ["linux", "linux-dev-setup"] }),
				}),
			);
		});

		// Platform value from member scripts' platform field
		expect(screen.getByText("ubuntu-24.04-x64")).toBeTruthy();
	});

	it("renders a copyable one-liner CodeBlock", async () => {
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);
		vi.mocked(loadScripts).mockResolvedValue([memberOne, memberTwo]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({ slug: ["linux", "linux-dev-setup"] }),
				}),
			);
		});

		// Should have a copy button
		expect(screen.getByRole("button", { name: "[copy]" })).toBeTruthy();
	});

	it("one-liner URL contains the group runner path", async () => {
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);
		vi.mocked(loadScripts).mockResolvedValue([memberOne, memberTwo]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({ slug: ["linux", "linux-dev-setup"] }),
				}),
			);
		});

		// The one-liner should contain the group ID and run-all.sh
		expect(screen.getByText(/linux-dev-setup.*run-all\.sh/)).toBeTruthy();
	});

	it("member list renders each member as a link to /scripts/<id>", async () => {
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);
		vi.mocked(loadScripts).mockResolvedValue([memberOne, memberTwo]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({ slug: ["linux", "linux-dev-setup"] }),
				}),
			);
		});

		const bunLink = screen.getByRole("link", { name: "Install Bun" });
		expect(bunLink.getAttribute("href")).toBe(`/scripts/${memberOne.id}`);

		const goLink = screen.getByRole("link", { name: "Install Go" });
		expect(goLink.getAttribute("href")).toBe(`/scripts/${memberTwo.id}`);
	});

	it("member list is in groupOrder ascending order", async () => {
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);
		// Pass members in reverse groupOrder
		const memberTwoFirst = makeScript({
			id: "linux/ubuntu-24.04-x64/install-go",
			title: "Install Go",
			description: "Installs the Go programming language.",
			runCommand:
				"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-go.sh | bash",
			groupOrder: 2,
		});
		const memberOneSecond = makeScript({
			id: "linux/ubuntu-24.04-x64/install-bun",
			title: "Install Bun",
			description: "Installs the Bun JavaScript runtime.",
			groupOrder: 1,
		});
		vi.mocked(loadScripts).mockResolvedValue([memberTwoFirst, memberOneSecond]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({ slug: ["linux", "linux-dev-setup"] }),
				}),
			);
		});

		const links = screen.getAllByRole("link");
		const memberLinks = links.filter((link) =>
			(link as HTMLAnchorElement).getAttribute("href")?.includes("/scripts/"),
		);
		// groupOrder 1 (Install Bun) should appear before groupOrder 2 (Install Go)
		expect(memberLinks[0].textContent).toBe("Install Bun");
		expect(memberLinks[1].textContent).toBe("Install Go");
	});

	it("calls notFound() for an unknown slug", async () => {
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);
		vi.mocked(loadScripts).mockResolvedValue([memberOne, memberTwo]);

		const { default: Page } = await importPage();

		await expect(
			Page({
				params: Promise.resolve({ slug: ["linux", "nonexistent-group"] }),
			}),
		).rejects.toThrow("NEXT_NOT_FOUND");
	});

	it("calls notFound() when group has no members", async () => {
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadGroups).mockResolvedValue([fixtureGroup]);
		// No scripts belong to this group
		vi.mocked(loadScripts).mockResolvedValue([
			makeScript({
				id: "linux/ubuntu-24.04-x64/install-bun",
				group: "other-group",
			}),
		]);

		const { default: Page } = await importPage();

		await expect(
			Page({
				params: Promise.resolve({ slug: ["linux", "linux-dev-setup"] }),
			}),
		).rejects.toThrow("NEXT_NOT_FOUND");
	});

	it("generateStaticParams returns only groups with valid members", async () => {
		const { loadGroups } = await import("../../../lib/loadGroups.js");
		const { loadScripts } = await import("../../../lib/loadScripts.js");

		const groupWithMembers: GroupEntry = {
			id: "linux-dev-setup",
			name: "Linux Dev Setup",
			description: "Has members.",
		};
		const groupWithoutMembers: GroupEntry = {
			id: "empty-group",
			name: "Empty Group",
			description: "Has no members.",
		};
		vi.mocked(loadGroups).mockResolvedValue([
			groupWithMembers,
			groupWithoutMembers,
		]);
		vi.mocked(loadScripts).mockResolvedValue([
			makeScript({ group: "linux-dev-setup" }),
		]);

		const { generateStaticParams } = await importPage();

		const params = await generateStaticParams();

		// Only linux-dev-setup has members; empty-group should be excluded
		expect(params).toHaveLength(1);
		expect(params[0].slug).toEqual(["linux", "linux-dev-setup"]);
	});
});
