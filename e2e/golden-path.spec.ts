import { test, expect } from "@playwright/test";
import { SEED } from "./fixtures/seed";

test("golden path: staff login → QR generate → guest access → order → fulfillment", async ({ browser }) => {
  test.slow(); // triples assertion + test timeouts; must be inside the test callback
  const staffCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const staffPage = await staffCtx.newPage();
  const guestPage = await guestCtx.newPage();
  const guestName = `E2E Guest ${Date.now()}`;

  const today = new Date().toISOString().slice(0, 10);
  const checkOut = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);

  try {
    // Phase A: Staff login + token generation
    await staffPage.goto("/auth/signin");
    await staffPage.getByLabel("Kod hotelu").fill(process.env.STAFF_TEST_HOTEL_CODE ?? "");
    await staffPage.getByLabel("Email").fill(process.env.STAFF_TEST_EMAIL ?? "");
    await staffPage.getByLabel("Password", { exact: true }).fill(process.env.STAFF_TEST_PASSWORD ?? "");
    await staffPage.getByRole("button", { name: /Sign in/i }).click();
    await staffPage.waitForURL("**/dashboard");

    await staffPage.goto("/dashboard/generate-token");
    // Wait for React to hydrate the TokenGeneratorForm before filling it
    await staffPage.waitForFunction(() => {
      const el = document.getElementById("guestName");
      return !!el && Object.keys(el).some((k) => k.startsWith("__reactFiber"));
    });
    await staffPage.getByLabel("Guest Name").fill(guestName);
    await staffPage.getByLabel("Room").selectOption(SEED.roomNumber);
    await staffPage.getByLabel("Package").selectOption(SEED.packageId);
    await staffPage.getByLabel("Check-in Date").fill(today);
    await staffPage.getByLabel("Check-out Date").fill(checkOut);

    const tokenResponsePromise = staffPage.waitForResponse(
      (r) => r.url().includes("/api/staff/generate-token") && r.request().method() === "POST",
    );
    await staffPage.getByRole("button", { name: /Generate Token/i }).click();
    const tokenResponse = await tokenResponsePromise;
    const { tokenValue } = (await tokenResponse.json()) as { tokenValue: string };

    await expect(staffPage.getByText(guestName)).toBeVisible();

    // Phase B: Guest 2-step QR access
    await guestPage.goto("/guest/verify?token=" + encodeURIComponent(tokenValue));
    await expect(guestPage.getByText(/Step 2 of 2/)).toBeVisible();

    await guestPage.goto("/qr/room/" + SEED.roomQrToken);
    await guestPage.waitForURL("**/guest/panel");
    // Wait for React to hydrate AddonList before clicking Order
    await guestPage.waitForFunction(() => {
      const articles = document.querySelectorAll("article");
      return (
        articles.length > 0 &&
        Array.from(articles).some((a) => Object.keys(a).some((k) => k.startsWith("__reactFiber")))
      );
    });
    await expect(guestPage.getByText(/Included in your package/i)).toBeVisible();

    // Phase C: Guest orders add-on
    const addonCard = guestPage.getByRole("article").filter({ hasText: SEED.serviceName });
    await expect(addonCard).toBeVisible();
    await addonCard.getByRole("button", { name: "Order" }).click();
    await expect(addonCard.getByText(/Awaiting/)).toBeVisible();

    // Phase D: Staff sees order, fulfills; guest confirms
    await staffPage.goto("/dashboard");
    const orderItem = staffPage.getByRole("listitem").filter({ hasText: guestName });
    await expect(orderItem).toBeVisible();
    await expect(staffPage.getByTestId("pending-badge")).toBeVisible();
    // Register listener before clicking so no PATCH response can be missed
    const fulfillResponsePromise = staffPage.waitForResponse(
      (r) => r.url().includes("/api/staff/orders/") && r.request().method() === "PATCH",
    );
    await orderItem.getByRole("button", { name: "Fulfill" }).click();
    await expect(staffPage.getByRole("alertdialog")).toBeVisible();
    await staffPage.getByRole("button", { name: "Confirm" }).click();
    // Wait for PATCH to complete — guarantees DB write before guest reload
    await fulfillResponsePromise;
    await expect(orderItem).not.toBeVisible();

    await guestPage.reload();
    await expect(
      guestPage
        .getByRole("article")
        .filter({ hasText: SEED.serviceName })
        .getByText(/Fulfilled/),
    ).toBeVisible();
  } finally {
    await staffCtx.close();
    await guestCtx.close();
  }
});
