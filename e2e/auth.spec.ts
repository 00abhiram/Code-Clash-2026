import { test, expect } from "@playwright/test";
import { config, signInViaAPI, signOutViaAPI } from "./helpers";

test.describe("Authentication E2E", () => {
  test.describe("unauthenticated", () => {
    test("login page renders correctly", async ({ page }) => {
      await page.goto(`${config.baseUrl}/login`);
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
    });

    test("signup page renders correctly", async ({ page }) => {
      await page.goto(`${config.baseUrl}/signup`);
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Password", exact: true })).toBeVisible();
    });

    test("invalid credentials show error", async ({ page }) => {
      await page.goto(`${config.baseUrl}/login`);
      await page.fill('input[type="email"]', "nonexistent@example.com");
      await page.fill('input[type="password"]', "wrongpassword123");
      await page.click('button[type="submit"]');
      // Wait for either error text or URL change (auth error)
      await page.waitForTimeout(5000);
      const body = await page.textContent("body");
      const hasError = /invalid|error|wrong|incorrect|fail/i.test(body || "");
      const stayedOnLogin = page.url().includes("/login");
      // Either shows error message or stays on login page
      expect(hasError || stayedOnLogin).toBe(true);
    });

    test("protected routes redirect to login", async ({ page }) => {
      const protectedRoutes = ["/dashboard", "/admin", "/admin/settings", "/admin/questions"];
      for (const route of protectedRoutes) {
        await page.goto(`${config.baseUrl}${route}`);
        expect(page.url()).toContain("/login");
      }
    });
  });

  test.describe("authenticated student", () => {
    test.skip(!config.hasCredentials, "Requires TEST_STUDENT_EMAIL and TEST_STUDENT_PASSWORD env vars");

    test("can sign in via API and access dashboard", async ({ page }) => {
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/dashboard`);
      await expect(page.locator("text=Dashboard").or(page.locator("text=Exam"))).toBeVisible({ timeout: 10_000 });
    });

    test("cannot access admin routes", async ({ page }) => {
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/admin`);
      expect(page.url()).not.toContain("/admin");
    });

    test("session persists across page refresh", async ({ page }) => {
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/dashboard`);
      await page.reload();
      expect(page.url()).toContain("/dashboard");
    });

    test("can sign out", async ({ page }) => {
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/dashboard`);
      await signOutViaAPI(page);
      await page.goto(`${config.baseUrl}/dashboard`);
      expect(page.url()).toContain("/login");
    });
  });

  test.describe("authenticated admin", () => {
    test.skip(!config.hasAdminCredentials, "Requires TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD env vars");

    test("can sign in and access admin dashboard", async ({ page }) => {
      await signInViaAPI(page, config.admin.email, config.admin.password);
      await page.goto(`${config.baseUrl}/admin`);
      await expect(page.locator("text=Admin Dashboard").or(page.locator("text=Overview"))).toBeVisible({ timeout: 10_000 });
    });

    test("can access admin settings", async ({ page }) => {
      await signInViaAPI(page, config.admin.email, config.admin.password);
      await page.goto(`${config.baseUrl}/admin/settings`);
      await expect(page.locator("text=Settings").or(page.locator("text=Anti-Cheat"))).toBeVisible({ timeout: 10_000 });
    });

    test("can access admin questions", async ({ page }) => {
      await signInViaAPI(page, config.admin.email, config.admin.password);
      await page.goto(`${config.baseUrl}/admin/questions`);
      await expect(page.locator("text=Question").or(page.locator("text=Bank"))).toBeVisible({ timeout: 10_000 });
    });

    test("can access admin leaderboard", async ({ page }) => {
      await signInViaAPI(page, config.admin.email, config.admin.password);
      await page.goto(`${config.baseUrl}/admin/leaderboard`);
      await expect(page.locator("text=Leaderboard").or(page.locator("text=Ranking"))).toBeVisible({ timeout: 10_000 });
    });
  });
});
