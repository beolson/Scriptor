import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.goto("/scripts/linux/ubuntu-24.04-x64/fixture-install-curl");
});

test("detail page shows the script title", async ({ page }) => {
	await expect(
		page.getByRole("heading", { name: "Fixture Install curl" }),
	).toBeVisible();
});

test("detail page shows single target tag via formatTarget", async ({
	page,
}) => {
	// formatTarget("ubuntu-24.04-x64") => "Ubuntu 24.04 X64"
	await expect(page.getByText("Ubuntu 24.04 X64").first()).toBeVisible();
});

test("detail page shows the run command text", async ({ page }) => {
	await expect(
		page.getByText(
			"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/fixture-install-curl.sh | bash",
		),
	).toBeVisible();
});

test("copy button is visible on the detail page", async ({ page }) => {
	await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();
});

test("mac detail page shows correct title and target tag", async ({ page }) => {
	await page.goto("/scripts/mac/macos-sequoia-arm64/fixture-install-brew");
	await expect(
		page.getByRole("heading", { name: "Fixture Install Brew" }),
	).toBeVisible();
	// formatTarget("macos-sequoia-arm64") => "Macos Sequoia Arm64"
	await expect(page.getByText("Macos Sequoia Arm64").first()).toBeVisible();
});

test("windows detail page shows correct title and target tag", async ({
	page,
}) => {
	await page.goto("/scripts/windows/windows-11-x64/fixture-setup-pkgmgr");
	await expect(
		page.getByRole("heading", { name: "Fixture Setup Package Manager" }),
	).toBeVisible();
	// formatTarget("windows-11-x64") => "Windows 11 X64"
	await expect(page.getByText("Windows 11 X64").first()).toBeVisible();
});
