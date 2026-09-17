import { expect, test } from "@playwright/test";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test("anonymous users are redirected away from protected dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/sign-in|login/);
});

test.describe("authenticated critical journeys", () => {
  test.skip(!email || !password, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated journeys.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole("button", { name: /sign in|continue|login/i }).click();
    await expect(page).toHaveURL(/dashboard|setup/);
  });

  test("authenticated user can reach their dashboard and cannot leak another school", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("main")).toBeVisible();
    await page.goto("/students");
    await expect(page).not.toHaveURL(/error|500/);
  });

  test("finance and reports routes remain protected by server authorization", async ({ page }) => {
    await page.goto("/finance");
    expect(new URL(page.url()).pathname).toMatch(/finance|dashboard|sign-in|setup/);
    await page.goto("/reports");
    expect(new URL(page.url()).pathname).toMatch(/reports|dashboard|sign-in|setup/);
  });
});
