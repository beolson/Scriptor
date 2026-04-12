import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { GroupEntry } from "@/lib/loadGroups";
import type { Script } from "@/lib/types";

import { GroupRow } from "./GroupRow.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const testGroup: GroupEntry = {
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
	groupOrder: 2,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GroupRow", () => {
	it("renders the group name", () => {
		render(<GroupRow group={testGroup} members={[memberOne]} />);
		expect(screen.getByText("Linux Dev Setup")).toBeTruthy();
	});

	it("renders the group description", () => {
		render(<GroupRow group={testGroup} members={[memberOne]} />);
		expect(
			screen.getByText(
				"Installs Bun, Go, .NET, and GitHub CLI on a fresh Linux machine.",
			),
		).toBeTruthy();
	});

	it("renders a badge element distinguishing it from ungrouped scripts", () => {
		render(<GroupRow group={testGroup} members={[memberOne]} />);
		// The badge should have some label-like text (e.g. "group")
		const badge = screen.getByTestId("group-badge");
		expect(badge).toBeTruthy();
	});

	it("defaults to collapsed state — member list is not visible", () => {
		render(<GroupRow group={testGroup} members={[memberOne, memberTwo]} />);
		expect(screen.queryByText("Install Bun")).toBeNull();
		expect(screen.queryByText("Install Go")).toBeNull();
	});

	it("clicking the expand toggle reveals the member list", () => {
		render(<GroupRow group={testGroup} members={[memberOne, memberTwo]} />);
		const toggle = screen.getByRole("button", {
			name: /expand|collapse|show|hide|\+/i,
		});
		fireEvent.click(toggle);
		expect(screen.getByText("Install Bun")).toBeTruthy();
		expect(screen.getByText("Install Go")).toBeTruthy();
	});

	it("clicking the expand toggle again collapses the member list", () => {
		render(<GroupRow group={testGroup} members={[memberOne, memberTwo]} />);
		const toggle = screen.getByRole("button", {
			name: /expand|collapse|show|hide|\+/i,
		});
		// Expand
		fireEvent.click(toggle);
		expect(screen.getByText("Install Bun")).toBeTruthy();
		// Collapse
		fireEvent.click(toggle);
		expect(screen.queryByText("Install Bun")).toBeNull();
	});

	it("expanded member list shows each member as a link", () => {
		render(<GroupRow group={testGroup} members={[memberOne, memberTwo]} />);
		fireEvent.click(
			screen.getByRole("button", { name: /expand|collapse|show|hide|\+/i }),
		);
		const links = screen.getAllByRole("link");
		// Filter to only member links (exclude the group name link)
		const memberLinks = links.filter((link) =>
			(link as HTMLAnchorElement).href.includes("/scripts/"),
		);
		expect(memberLinks.length).toBe(2);
	});

	it("member link href is /scripts/<member.id>", () => {
		render(<GroupRow group={testGroup} members={[memberOne]} />);
		fireEvent.click(
			screen.getByRole("button", { name: /expand|collapse|show|hide|\+/i }),
		);
		const memberLink = screen.getByRole("link", { name: /Install Bun/i });
		expect((memberLink as HTMLAnchorElement).getAttribute("href")).toBe(
			`/scripts/${memberOne.id}`,
		);
	});

	it("member description renders beneath the member title in expanded list", () => {
		render(<GroupRow group={testGroup} members={[memberOne]} />);
		fireEvent.click(
			screen.getByRole("button", { name: /expand|collapse|show|hide|\+/i }),
		);
		expect(
			screen.getByText("Installs the Bun JavaScript runtime."),
		).toBeTruthy();
	});

	it("group name is a link to the group detail URL /groups/<platform>/<group-id>", () => {
		render(<GroupRow group={testGroup} members={[memberOne]} />);
		const groupLink = screen.getByRole("link", { name: "Linux Dev Setup" });
		// Platform is derived from the first member's id prefix
		expect((groupLink as HTMLAnchorElement).getAttribute("href")).toBe(
			`/groups/linux/${testGroup.id}`,
		);
	});

	it("collapsed state shows no member items", () => {
		render(<GroupRow group={testGroup} members={[memberOne, memberTwo]} />);
		// Should not show any member titles in collapsed state
		expect(screen.queryByRole("link", { name: "Install Bun" })).toBeNull();
		expect(screen.queryByRole("link", { name: "Install Go" })).toBeNull();
	});

	it("renders correctly with an empty members array", () => {
		// Should not crash; badge and description still render
		render(<GroupRow group={testGroup} members={[]} />);
		expect(screen.getByText("Linux Dev Setup")).toBeTruthy();
		expect(screen.getByTestId("group-badge")).toBeTruthy();
	});
});
