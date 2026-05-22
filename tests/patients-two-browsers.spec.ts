import { test, expect, type BrowserContext, type Page } from "@playwright/test";

/**
 * Two-browser CRUD test against the local Next.js app at baseURL.
 *
 * Reproduces the original "One time key already exists" scenario by signing in
 * the SAME Matrix account in two browser contexts (= two devices) and exercising
 * patient create / read / message-send / delete across them.
 *
 * Requires .env.local (see .env.local.example).
 */

const HOMESERVER = process.env.MATRIX_HOMESERVER_URL ?? "";
const IDENTITY = process.env.MATRIX_IDENTITY_SERVER_URL ?? "";
const TOKEN_A = process.env.MATRIX_ACCESS_TOKEN_A ?? "";
const TOKEN_B = process.env.MATRIX_ACCESS_TOKEN_B ?? "";
const RECOVERY_KEY = process.env.MATRIX_RECOVERY_KEY ?? "";

test.beforeAll(() => {
  const missing: string[] = [];
  if (!HOMESERVER) missing.push("MATRIX_HOMESERVER_URL");
  if (!TOKEN_A) missing.push("MATRIX_ACCESS_TOKEN_A");
  if (!TOKEN_B) missing.push("MATRIX_ACCESS_TOKEN_B");
  if (!RECOVERY_KEY) missing.push("MATRIX_RECOVERY_KEY");
  if (missing.length) {
    throw new Error(
      `Missing env vars: ${missing.join(", ")}. Copy .env.local.example to .env.local and fill it in.`,
    );
  }
});

async function signIn(page: Page, token: string) {
  await page.goto("/");
  await page.getByLabel("Homeserver").fill(HOMESERVER);
  if (IDENTITY) {
    await page.getByLabel("Identity server").fill(IDENTITY);
  }
  await page.getByLabel("Access token").fill(token);
  await page.getByLabel("Recovery key").fill(RECOVERY_KEY);
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByRole("heading", { name: "Patients" })).toBeVisible({
    timeout: 120_000,
  });
}

/** Attach a network listener that fails the test if the homeserver responds with
 *  "One time key ... already exists" on /keys/upload. This is the original bug. */
function watchForOtkCollision(context: BrowserContext, label: string) {
  const errors: string[] = [];
  context.on("response", async (resp) => {
    const url = resp.url();
    if (!url.includes("/_matrix/client/v3/keys/upload")) return;
    if (resp.status() !== 400) return;
    let body = "";
    try {
      body = await resp.text();
    } catch {
      /* ignore */
    }
    if (body.includes("One time key") && body.includes("already exists")) {
      errors.push(`[${label}] OTK collision: ${body}`);
    }
  });
  return errors;
}

test("two browsers, same account: create / read / message / delete a patient", async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const otkErrorsA = watchForOtkCollision(ctxA, "A");
  const otkErrorsB = watchForOtkCollision(ctxB, "B");

  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await test.step("sign in same account in both contexts", async () => {
    await signIn(pageA, TOKEN_A);
    await signIn(pageB, TOKEN_B);
  });

  const patientName = `Playwright Test ${Date.now()}`;

  await test.step("A creates a patient", async () => {
    await pageA.getByRole("button", { name: "New patient" }).click();
    await pageA.getByLabel("Name").fill(patientName);
    await pageA.getByLabel("Email").fill("e2e@example.test");
    await pageA.getByLabel("Notes").fill("created by playwright");
    await pageA.getByRole("button", { name: "Create patient" }).click();
    // Dialog closes and row appears in A's table.
    await expect(
      pageA.getByRole("link", { name: patientName }),
    ).toBeVisible({ timeout: 60_000 });
  });

  await test.step("B sees the new patient via sync", async () => {
    await expect(
      pageB.getByRole("link", { name: patientName }),
    ).toBeVisible({ timeout: 90_000 });
  });

  await test.step("B opens the patient and sends a message", async () => {
    await pageB.getByRole("link", { name: patientName }).click();
    await expect(
      pageB.getByRole("heading", { name: patientName }),
    ).toBeVisible({ timeout: 30_000 });
    const msg = `hello from B ${Date.now()}`;
    await pageB.getByPlaceholder("Type a message…").fill(msg);
    await pageB.getByRole("button", { name: "Send" }).click();
    // Message echoes back to B's timeline.
    await expect(pageB.getByText(msg)).toBeVisible({ timeout: 30_000 });

    // A opens the same patient and sees the message.
    await pageA.getByRole("link", { name: patientName }).click();
    await expect(
      pageA.getByRole("heading", { name: patientName }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(pageA.getByText(msg)).toBeVisible({ timeout: 90_000 });
  });

  await test.step("A goes back and deletes the patient", async () => {
    await pageA.getByRole("link", { name: "← Back to patients" }).click();
    await expect(
      pageA.getByRole("heading", { name: "Patients" }),
    ).toBeVisible();

    // The delete confirm uses window.confirm — auto-accept.
    pageA.once("dialog", (d) => void d.accept());
    const row = pageA
      .getByRole("row")
      .filter({ has: pageA.getByRole("link", { name: patientName }) });
    await row.getByRole("button", { name: "⋯" }).click();
    await pageA.getByRole("menuitem", { name: "Delete" }).click();

    await expect(
      pageA.getByRole("link", { name: patientName }),
    ).toHaveCount(0, { timeout: 60_000 });
  });

  await test.step("B sees the patient gone", async () => {
    await pageB.getByRole("link", { name: "← Back to patients" }).click();
    await expect(
      pageB.getByRole("link", { name: patientName }),
    ).toHaveCount(0, { timeout: 90_000 });
  });

  await test.step("no OTK collision occurred", async () => {
    const all = [...otkErrorsA, ...otkErrorsB];
    expect(all, all.join("\n")).toEqual([]);
  });

  await ctxA.close();
  await ctxB.close();
});
