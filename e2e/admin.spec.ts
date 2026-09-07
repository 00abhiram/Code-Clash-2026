import { test, expect } from "@playwright/test";
import { config, signInViaAPI } from "./helpers";

test.describe("Admin E2E", () => {
  test.describe("admin dashboard", () => {
    test.skip(!config.hasAdminCredentials, "Requires test admin credentials");

    test("admin dashboard shows stats", async ({ page }) => {
      await signInViaAPI(page, config.admin.email, config.admin.password);
      await page.goto(`${config.baseUrl}/admin`);
      await expect(page.locator("text=Registered").or(page.locator("text=Admin Dashboard"))).toBeVisible({ timeout: 10_000 });
    });

    test("admin dashboard shows navigation links", async ({ page }) => {
      await signInViaAPI(page, config.admin.email, config.admin.password);
      await page.goto(`${config.baseUrl}/admin`);
      await expect(page.locator("text=Question Bank").or(page.locator("text=Questions"))).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("text=Leaderboard")).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("text=Settings")).toBeVisible({ timeout: 10_000 });
    });

    test("admin dashboard has stat cards", async ({ page }) => {
      await signInViaAPI(page, config.admin.email, config.admin.password);
      await page.goto(`${config.baseUrl}/admin`);
      // Should see stat labels
      await expect(page.locator("text=Registered")).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("text=Active Now").or(page.locator("text=Active"))).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe("admin questions page", () => {
    test.skip(!config.hasAdminCredentials, "Requires test admin credentials");

    test("questions page loads", async ({ page }) => {
      await signInViaAPI(page, config.admin.email, config.admin.password);
      await page.goto(`${config.baseUrl}/admin/questions`);
      await expect(
        page.locator("text=Question").or(page.locator("text=Bank")).or(page.locator("text=Add"))
      ).toBeVisible({ timeout: 10_000 });
    });

    test("questions page has add question button", async ({ page }) => {
      await signInViaAPI(page, config.admin.email, config.admin.password);
      await page.goto(`${config.baseUrl}/admin/questions`);
      await expect(
        page.locator("text=Add Question").or(page.locator("text=Create")).or(page.locator("button").filter({ hasText: /add|create/i }))
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe("admin settings page", () => {
    test.skip(!config.hasAdminCredentials, "Requires test admin credentials");

    test("settings page loads", async ({ page }) => {
      await signInViaAPI(page, config.admin.email, config.admin.password);
      await page.goto(`${config.baseUrl}/admin/settings`);
      await expect(
        page.locator("text=Settings").or(page.locator("text=Anti-Cheat")).or(page.locator("text=Duration"))
      ).toBeVisible({ timeout: 10_000 });
    });

    test("settings page shows duration fields", async ({ page }) => {
      await signInViaAPI(page, config.admin.email, config.admin.password);
      await page.goto(`${config.baseUrl}/admin/settings`);
      await expect(
        page.locator("text=Duration").or(page.locator("text=minutes")).or(page.locator("text=exam1"))
      ).toBeVisible({ timeout: 10_000 });
    });

    test("settings page shows unlock times", async ({ page }) => {
      await signInViaAPI(page, config.admin.email, config.admin.password);
      await page.goto(`${config.baseUrl}/admin/settings`);
      await expect(
        page.locator("text=Unlock").or(page.locator("text=unlock")).or(page.locator("text=exam1"))
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe("admin leaderboard page", () => {
    test.skip(!config.hasAdminCredentials, "Requires test admin credentials");

    test("leaderboard page loads", async ({ page }) => {
      await signInViaAPI(page, config.admin.email, config.admin.password);
      await page.goto(`${config.baseUrl}/admin/leaderboard`);
      await expect(
        page.locator("text=Leaderboard").or(page.locator("text=Ranking")).or(page.locator("text=Exam"))
      ).toBeVisible({ timeout: 10_000 });
    });

    test("leaderboard has exam tabs", async ({ page }) => {
      await signInViaAPI(page, config.admin.email, config.admin.password);
      await page.goto(`${config.baseUrl}/admin/leaderboard`);
      // Should see exam 1 / exam 2 tabs or similar
      await expect(
        page.locator("text=Exam 1").or(page.locator("text=Round 1")).or(page.locator("text=1"))
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe("admin cannot be accessed by student", () => {
    test.skip(!config.hasCredentials, "Requires test student credentials");

    test("student redirected from admin", async ({ page }) => {
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/admin`);
      const url = page.url();
      expect(url).not.toContain("/admin");
    });
  });
});
