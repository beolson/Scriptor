import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const PAGE_SOURCE = fs.readFileSync(
	path.join(__dirname, "page.tsx"),
	"utf-8",
);

describe("HomePage copy cleanup", () => {
	it("does not contain the 'cross-platform script management' badge text", () => {
		expect(PAGE_SOURCE).not.toContain("cross-platform script management");
	});

	it("does not contain the 'install, manage, and run scripts' subheadline text", () => {
		expect(PAGE_SOURCE).not.toContain(
			"install, manage, and run scripts",
		);
	});

	it("still renders the hero section with the headline", () => {
		expect(PAGE_SOURCE).toContain("hero");
		expect(PAGE_SOURCE).toContain("scriptor");
	});

	it("still renders the platforms section", () => {
		expect(PAGE_SOURCE).toContain("platforms");
		expect(PAGE_SOURCE).toContain("PlatformCard");
	});
});
