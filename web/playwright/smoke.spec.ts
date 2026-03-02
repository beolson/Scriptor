import { expect, test } from "@playwright/test";

test("homepage has title containing Scriptor", async ({ page }) => {
	await page.goto("/");
	await expect(page).toHaveTitle(/Scriptor/);
});
