import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const FOOTER_SOURCE = fs.readFileSync(
	path.join(__dirname, "Footer.tsx"),
	"utf-8",
);

describe("Footer copy cleanup", () => {
	it("does not contain the 'manage your scripts' text", () => {
		expect(FOOTER_SOURCE).not.toContain("manage your scripts");
	});

	it("still renders the footer with the brand name", () => {
		expect(FOOTER_SOURCE).toContain("footer");
		expect(FOOTER_SOURCE).toContain("scriptor");
	});

	it("still renders the GitHub link", () => {
		expect(FOOTER_SOURCE).toContain("github");
	});
});
