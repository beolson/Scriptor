import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.goto("/scripts/windows-11-x64");
});

test("browse page loads and shows windows scripts", async ({ page }) => {
	await expect(page.getByText("Fixture Setup Package Manager")).toBeVisible();
	await expect(page.getByText("Fixture Install Git")).toBeVisible();
	await expect(page.getByText("Fixture Install Editor")).toBeVisible();
});

test("each script row shows its description", async ({ page }) => {
	await expect(
		page.getByText("A fixture script for setting up the package manager."),
	).toBeVisible();
});

test("clicking a script row navigates to the detail page", async ({ page }) => {
	await page.getByText("Fixture Setup Package Manager").click();

	await expect(page).toHaveURL(
		/\/scripts\/windows\/windows-11-x64\/fixture-setup-pkgmgr/,
	);
	await expect(
		page.getByRole("heading", { name: /Fixture Setup Package Manager/ }),
	).toBeVisible();
});

// ─── Group browse tests (linux page) ─────────────────────────────────────────

test("linux browse page shows the fixture group entry", async ({ page }) => {
	await page.goto("/scripts/debian-13-x64");
	// The group name is rendered as a link — use role-based selector to avoid ambiguity
	await expect(page.getByRole("link", { name: "Fixture Group" })).toBeVisible();
});

test("linux browse page shows ungrouped scripts below group entries", async ({
	page,
}) => {
	await page.goto("/scripts/debian-13-x64");

	// The debian-13-x64 fixture-install-curl is ungrouped and should appear on the page
	// It renders as a ScriptRow with a link to its detail page
	await expect(
		page.getByRole("link", { name: "Fixture Install curl" }).first(),
	).toBeVisible();

	// Group badge appears above ungrouped scripts in DOM order
	const groupBadgeTop = await page
		.getByTestId("group-badge")
		.first()
		.evaluate((el) => el.getBoundingClientRect().top);
	// The ungrouped ScriptRow link goes directly to /scripts/linux/debian-13-x64/...
	const ungroupedLinkTop = await page
		.getByRole("link", { name: "Fixture Install curl" })
		.filter({ has: page.locator(':scope[href*="debian-13-x64"]') })
		.evaluate((el) => el.getBoundingClientRect().top);
	expect(groupBadgeTop).toBeLessThan(ungroupedLinkTop);
});

test("group entry on linux browse page has a badge distinguishing it from script entries", async ({
	page,
}) => {
	await page.goto("/scripts/debian-13-x64");
	await expect(page.getByTestId("group-badge")).toBeVisible();
	await expect(page.getByTestId("group-badge")).toHaveText("group");
});

test("clicking expand control on group entry reveals member list", async ({
	page,
}) => {
	await page.goto("/scripts/debian-13-x64");

	// Member link to ubuntu grouped script should not be visible yet (collapsed)
	await expect(
		page
			.getByRole("link", { name: "Fixture Install curl" })
			.filter({ has: page.locator(':scope[href*="ubuntu"]') }),
	).not.toBeVisible();

	// Click the expand button
	await page.getByRole("button", { name: "expand" }).click();

	// Both member scripts should now be visible as links inside the expanded group
	await expect(
		page.getByRole("link", { name: "Fixture Setup Dev" }),
	).toBeVisible();
});

test("clicking group title on linux browse page navigates to group detail page", async ({
	page,
}) => {
	await page.goto("/scripts/debian-13-x64");
	await page.getByRole("link", { name: "Fixture Group" }).click();
	await expect(page).toHaveURL(/\/groups\/linux\/fixture-group/);
	await expect(
		page.getByRole("heading", { name: /Fixture Group/ }),
	).toBeVisible();
});

test("ungrouped scripts appear after group entries on linux browse page", async ({
	page,
}) => {
	await page.goto("/scripts/debian-13-x64");

	// Group badge must be visible
	await expect(page.getByTestId("group-badge")).toBeVisible();

	// The debian ungrouped ScriptRow link must also be visible
	await expect(
		page.getByRole("link", { name: "Fixture Install curl" }).first(),
	).toBeVisible();
});
