import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.goto("/groups/linux/fixture-group");
});

test("group detail page renders group title in h1", async ({ page }) => {
	await expect(
		page.getByRole("heading", { name: /Fixture Group/ }),
	).toBeVisible();
});

test("group detail page renders group description", async ({ page }) => {
	await expect(page.getByText("E2E test fixture group.")).toBeVisible();
});

test("group detail page renders a copyable one-liner run command", async ({
	page,
}) => {
	// The CodeBlock contains the curl | bash command for the group runner
	await expect(
		page.getByText(/curl -fsSL.*fixture-group.*run-all\.sh.*bash/),
	).toBeVisible();
});

test("group detail page one-liner URL contains the group runner path", async ({
	page,
}) => {
	await expect(
		page.getByText(/linux\/fixture-group\/run-all\.sh/),
	).toBeVisible();
});

test("group detail page lists member scripts as links to their detail pages", async ({
	page,
}) => {
	// Both member scripts should be visible as links
	await expect(
		page.getByRole("link", { name: "Fixture Install curl" }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Fixture Setup Dev" }),
	).toBeVisible();
});

test("member script links navigate to individual script detail pages", async ({
	page,
}) => {
	await page.getByRole("link", { name: "Fixture Install curl" }).click();
	await expect(page).toHaveURL(
		/\/scripts\/linux\/ubuntu-24\.04-x64\/fixture-install-curl/,
	);
	await expect(
		page.getByRole("heading", { name: /Fixture Install curl/ }),
	).toBeVisible();
});

test("group detail page shows copy button", async ({ page }) => {
	await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();
});
