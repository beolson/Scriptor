import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

describe("hljs-themes dual theme scoping", () => {
	it("layout.tsx does not import the unscoped highlight.js/styles/github.css directly", () => {
		const layoutSource = fs.readFileSync(
			path.join(__dirname, "layout.tsx"),
			"utf-8",
		);
		// Should NOT have an unscoped import of highlight.js/styles/github.css
		expect(layoutSource).not.toContain(
			'import "highlight.js/styles/github.css"',
		);
	});

	it("layout.tsx imports the scoped hljs-themes.css file", () => {
		const layoutSource = fs.readFileSync(
			path.join(__dirname, "layout.tsx"),
			"utf-8",
		);
		expect(layoutSource).toContain("hljs-themes.css");
	});

	it("hljs-themes.css exists", () => {
		const filePath = path.join(__dirname, "hljs-themes.css");
		expect(fs.existsSync(filePath)).toBe(true);
	});

	it("hljs-themes.css contains light theme styles scoped under [data-theme=\"light\"]", () => {
		const css = fs.readFileSync(
			path.join(__dirname, "hljs-themes.css"),
			"utf-8",
		);
		expect(css).toContain('[data-theme="light"]');
		// Light theme should contain .hljs selector nested/scoped under [data-theme="light"]
		const lightBlock = extractThemeBlock(css, '[data-theme="light"]');
		expect(lightBlock).toContain(".hljs");
	});

	it("hljs-themes.css contains dark theme styles scoped under [data-theme=\"dark\"]", () => {
		const css = fs.readFileSync(
			path.join(__dirname, "hljs-themes.css"),
			"utf-8",
		);
		expect(css).toContain('[data-theme="dark"]');
		// Dark theme should contain .hljs selector nested/scoped under [data-theme="dark"]
		const darkBlock = extractThemeBlock(css, '[data-theme="dark"]');
		expect(darkBlock).toContain(".hljs");
	});

	it("light theme block contains github light colors", () => {
		const css = fs.readFileSync(
			path.join(__dirname, "hljs-themes.css"),
			"utf-8",
		);
		const lightBlock = extractThemeBlock(css, '[data-theme="light"]');
		// GitHub light theme uses #24292e as base color
		expect(lightBlock).toContain("#24292e");
	});

	it("dark theme block contains github dark colors", () => {
		const css = fs.readFileSync(
			path.join(__dirname, "hljs-themes.css"),
			"utf-8",
		);
		const darkBlock = extractThemeBlock(css, '[data-theme="dark"]');
		// GitHub dark theme uses #c9d1d9 as base color
		expect(darkBlock).toContain("#c9d1d9");
	});
});

/**
 * Extracts the content of a CSS rule block by its selector.
 * Finds the selector, then captures everything between the first { and its matching }.
 */
function extractThemeBlock(css: string, selector: string): string {
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
