import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

test.describe("smoke — build output", () => {
	test("out/index.html exists and contains scriptor", () => {
		const outIndex = resolve(__dirname, "../out/index.html");
		expect(existsSync(outIndex)).toBe(true);
		const content = require("node:fs").readFileSync(outIndex, "utf-8");
		expect(content.toLowerCase()).toContain("scriptor");
	});
});

test.describe("smoke — homepage", () => {
	test("homepage loads and contains scriptor", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("body")).toContainText(/scriptor/i);
	});
});

test.describe("atom components — Task 4", () => {
	test("arch-badge has IBM Plex Mono font and 11px font size", async ({
		page,
	}) => {
		await page.goto("/scripts/windows");
		const badge = page.locator('[data-testid="arch-badge"]').first();
		await expect(badge).toBeVisible();
		const fontFamily = await badge.evaluate(
			(el) => getComputedStyle(el).fontFamily,
		);
		expect(fontFamily.toLowerCase()).toContain("mono");
		const fontSize = await badge.evaluate(
			(el) => getComputedStyle(el).fontSize,
		);
		expect(fontSize).toBe("11px");
	});
});

test.describe("design tokens — Task 2", () => {
	test("--color-accent is #059669", async ({ page }) => {
		await page.goto("/");
		const accentValue = await page.evaluate(() =>
			getComputedStyle(document.body).getPropertyValue("--color-accent").trim(),
		);
		expect(accentValue).toBe("#059669");
	});

	test("body uses a monospace font family", async ({ page }) => {
		await page.goto("/");
		const fontFamily = await page.evaluate(
			() => getComputedStyle(document.body).fontFamily,
		);
		expect(fontFamily.toLowerCase()).toContain("mono");
	});

	test("all 6 color tokens are present", async ({ page }) => {
		await page.goto("/");
		const tokens = await page.evaluate(() => {
			const style = getComputedStyle(document.documentElement);
			return {
				bg: style.getPropertyValue("--color-bg").trim(),
				surface: style.getPropertyValue("--color-surface").trim(),
				border: style.getPropertyValue("--color-border").trim(),
				textPrimary: style.getPropertyValue("--color-text-primary").trim(),
				textMuted: style.getPropertyValue("--color-text-muted").trim(),
				accent: style.getPropertyValue("--color-accent").trim(),
			};
		});
		expect(tokens.bg).toMatch(/^#fff(fff)?$/i);
		expect(tokens.surface).toBe("#f9fafb");
		expect(tokens.border).toBe("#e5e7eb");
		expect(tokens.textPrimary).toMatch(/^#111(111)?$/i);
		expect(tokens.textMuted).toBe("#6b7280");
		expect(tokens.accent).toBe("#059669");
	});

	test("JetBrains Mono and IBM Plex Mono font variables are applied to html", async ({
		page,
	}) => {
		await page.goto("/");
		const fonts = await page.evaluate(() => {
			const style = getComputedStyle(document.documentElement);
			return {
				jetbrains: style.getPropertyValue("--font-jetbrains").trim(),
				ibmplex: style.getPropertyValue("--font-ibmplex").trim(),
			};
		});
		expect(fonts.jetbrains).not.toBe("");
		expect(fonts.ibmplex).not.toBe("");
	});
});

test.describe("layout chrome — Task 8", () => {
	test("navbar is visible with text '> scriptor'", async ({ page }) => {
		await page.goto("/");
		const navbar = page.locator('[data-testid="navbar"]');
		await expect(navbar).toBeVisible();
		await expect(navbar).toContainText("> scriptor");
	});

	test("navbar contains github link", async ({ page }) => {
		await page.goto("/");
		const navbar = page.locator('[data-testid="navbar"]');
		await expect(navbar).toContainText("github");
	});

	test("footer is visible with text 'manage your scripts'", async ({
		page,
	}) => {
		await page.goto("/");
		const footer = page.locator('[data-testid="footer"]');
		await expect(footer).toBeVisible();
		await expect(footer).toContainText("manage your scripts");
	});

	test("footer contains github link", async ({ page }) => {
		await page.goto("/");
		const footer = page.locator('[data-testid="footer"]');
		await expect(footer).toContainText("github");
	});
});
