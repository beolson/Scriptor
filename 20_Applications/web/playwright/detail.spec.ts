import { expect, test } from "@playwright/test";

// RED tests for Task 5 — Row Components: Breadcrumb, MetadataRow, DistroGroupHeader
// These tests fail until Task 11 (script detail page) is implemented.
// The components themselves are created in Task 5; full Playwright validation
// occurs once the detail page at /scripts/[id] is complete.

test.describe("detail page — Task 5 components (RED until Task 11)", () => {
	test("breadcrumb is visible on /scripts/install-git-gh", async ({ page }) => {
		await page.goto("/scripts/install-git-gh");
		const breadcrumb = page.locator('[data-testid="breadcrumb"]');
		await expect(breadcrumb).toBeVisible();
	});

	test("metadata-row elements exist and contain text 'platform'", async ({
		page,
	}) => {
		await page.goto("/scripts/install-git-gh");
		const rows = page.locator('[data-testid="metadata-row"]');
		await expect(rows.first()).toBeVisible();
		const allText = await page
			.locator('[data-testid="metadata-row"]')
			.allTextContents();
		const hasPlatform = allText.some((t) =>
			t.toLowerCase().includes("platform"),
		);
		expect(hasPlatform).toBe(true);
	});
});

// Task 11 — Script Detail Page (/scripts/[id])

test.describe("detail page — Task 11", () => {
	test("heading > install-git-gh is visible", async ({ page }) => {
		await page.goto("/scripts/install-git-gh");
		const heading = page.locator('[data-testid="detail-heading"]');
		await expect(heading).toBeVisible();
		await expect(heading).toContainText("> install-git-gh");
	});

	test("metadata-row elements are present", async ({ page }) => {
		await page.goto("/scripts/install-git-gh");
		const rows = page.locator('[data-testid="metadata-row"]');
		await expect(rows.first()).toBeVisible();
	});

	test("arch-badge is present", async ({ page }) => {
		await page.goto("/scripts/install-git-gh");
		const badge = page.locator('[data-testid="arch-badge"]').first();
		await expect(badge).toBeVisible();
	});

	test("spec-content contains rendered markdown after expanding", async ({
		page,
	}) => {
		await page.goto("/scripts/install-git-gh");
		// Spec is collapsed by default — click to expand
		const specToggle = page.getByRole("button", { name: /spec/ });
		await specToggle.click();
		const specContent = page.locator('[data-testid="spec-content"]');
		await expect(specContent).toBeVisible();
		// Should contain at least one paragraph or heading from the rendered markdown
		const hasMarkdown =
			(await specContent.locator("p, h1, h2, h3").count()) > 0;
		expect(hasMarkdown).toBe(true);
	});

	test("deps-card lists at least one dependency tag", async ({ page }) => {
		await page.goto("/scripts/install-git-gh");
		const depsCard = page.locator('[data-testid="deps-card"]');
		await expect(depsCard).toBeVisible();
		const tags = depsCard.locator('[data-testid="dependency-tag"]');
		await expect(tags.first()).toBeVisible();
	});
});
