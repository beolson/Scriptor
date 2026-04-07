import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.goto("/scripts/linux/ubuntu-24.04/install-curl");
});

test("detail page shows the script title", async ({ page }) => {
	await expect(
		page.getByRole("heading", { name: "Install curl" }),
	).toBeVisible();
});

test("detail page shows platform metadata", async ({ page }) => {
	// The metadata row contains span tags with platform/os values
	await expect(page.getByText("linux", { exact: true }).first()).toBeVisible();
});

test("detail page shows OS metadata", async ({ page }) => {
	await expect(
		page.getByText("ubuntu-24.04", { exact: true }).first(),
	).toBeVisible();
});

test("detail page shows the run command text", async ({ page }) => {
	await expect(
		page.getByText(
			"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04/install-curl.sh | bash",
		),
	).toBeVisible();
});

test("copy button is visible on the detail page", async ({ page }) => {
	await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();
});

test("windows detail page shows irm run command", async ({ page }) => {
	await page.goto("/scripts/windows/windows-11/setup-winget");
	await expect(
		page.getByRole("heading", { name: "Setup winget" }),
	).toBeVisible();
	await expect(
		page.getByText(
			"irm https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/windows/windows-11/setup-winget.ps1 | iex",
		),
	).toBeVisible();
});

test("mac detail page shows correct title and metadata", async ({ page }) => {
	await page.goto("/scripts/mac/macos-sequoia/install-homebrew");
	await expect(
		page.getByRole("heading", { name: "Install Homebrew" }),
	).toBeVisible();
	await expect(page.getByText("mac", { exact: true }).first()).toBeVisible();
	await expect(
		page.getByText("macos-sequoia", { exact: true }).first(),
	).toBeVisible();
});
