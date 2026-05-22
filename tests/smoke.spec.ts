import { test, expect } from "@playwright/test";

/**
 * Harness smoke test: no Matrix creds required. Confirms the dev server boots
 * and the sign-in form renders in two independent browser contexts.
 */
test("two contexts both render the sign-in form", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await pageA.goto("/");
  await pageB.goto("/");

  await expect(
    pageA.getByRole("heading", { name: "Connect to Matrix" }),
  ).toBeVisible();
  await expect(pageA.getByLabel("Access token")).toBeVisible();

  await expect(
    pageB.getByRole("heading", { name: "Connect to Matrix" }),
  ).toBeVisible();
  await expect(pageB.getByLabel("Access token")).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});
