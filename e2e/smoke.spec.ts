import { test, expect } from "@playwright/test";

test("smoke: home page loads with heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "RoomPilot" })).toBeVisible();
});
