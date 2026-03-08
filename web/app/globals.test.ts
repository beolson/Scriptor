import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const CSS_SOURCE = fs.readFileSync(
	path.join(__dirname, "globals.css"),
	"utf-8",
);

describe("globals.css dark theme custom properties", () => {
	it('contains a [data-theme="dark"] rule block', () => {
		expect(CSS_SOURCE).toContain('[data-theme="dark"]');
	});

	it("defines --color-bg override in dark theme", () => {
		const darkBlock = extractBlock(CSS_SOURCE, '[data-theme="dark"]');
		expect(darkBlock).toContain("--color-bg:");
	});

	it("defines --color-text-primary override in dark theme", () => {
		const darkBlock = extractBlock(CSS_SOURCE, '[data-theme="dark"]');
		expect(darkBlock).toContain("--color-text-primary:");
	});

	it("defines --color-accent override in dark theme", () => {
		const darkBlock = extractBlock(CSS_SOURCE, '[data-theme="dark"]');
		expect(darkBlock).toContain("--color-accent:");
	});

	it("defines --color-surface override in dark theme", () => {
		const darkBlock = extractBlock(CSS_SOURCE, '[data-theme="dark"]');
		expect(darkBlock).toContain("--color-surface:");
	});

	it("defines --color-border override in dark theme", () => {
		const darkBlock = extractBlock(CSS_SOURCE, '[data-theme="dark"]');
		expect(darkBlock).toContain("--color-border:");
	});

	it("defines --color-text-muted override in dark theme", () => {
		const darkBlock = extractBlock(CSS_SOURCE, '[data-theme="dark"]');
		expect(darkBlock).toContain("--color-text-muted:");
	});
});

describe("globals.css light theme explicit scoping", () => {
	it('contains a [data-theme="light"] rule block', () => {
		expect(CSS_SOURCE).toContain('[data-theme="light"]');
	});

	it("defines --color-bg in light theme block", () => {
		const lightBlock = extractBlock(CSS_SOURCE, '[data-theme="light"]');
		expect(lightBlock).toContain("--color-bg:");
	});

	it("defines --color-text-primary in light theme block", () => {
		const lightBlock = extractBlock(CSS_SOURCE, '[data-theme="light"]');
		expect(lightBlock).toContain("--color-text-primary:");
	});

	it("defines --color-accent in light theme block", () => {
		const lightBlock = extractBlock(CSS_SOURCE, '[data-theme="light"]');
		expect(lightBlock).toContain("--color-accent:");
	});
});

describe("globals.css :root values unchanged", () => {
	it("preserves the original :root --color-bg value", () => {
		const rootBlock = extractBlock(CSS_SOURCE, ":root");
		expect(rootBlock).toContain("--color-bg: #ffffff");
	});

	it("preserves the original :root --color-text-primary value", () => {
		const rootBlock = extractBlock(CSS_SOURCE, ":root");
		expect(rootBlock).toContain("--color-text-primary: #111111");
	});

	it("preserves the original :root --color-accent value", () => {
		const rootBlock = extractBlock(CSS_SOURCE, ":root");
		expect(rootBlock).toContain("--color-accent: #059669");
	});
});

/**
 * Extracts the content of a CSS rule block by its selector.
 * Finds the selector, then captures everything between the first { and its matching }.
 */
function extractBlock(css: string, selector: string): string {
	const idx = css.indexOf(selector);
	if (idx === -1) return "";

	const openBrace = css.indexOf("{", idx);
	if (openBrace === -1) return "";

	let depth = 0;
	let closeBrace = -1;
	for (let i = openBrace; i < css.length; i++) {
		if (css[i] === "{") depth++;
		if (css[i] === "}") {
			depth--;
			if (depth === 0) {
				closeBrace = i;
				break;
			}
		}
	}

	if (closeBrace === -1) return "";
	return css.slice(openBrace + 1, closeBrace);
}
