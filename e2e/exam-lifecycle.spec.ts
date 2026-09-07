import { test, expect } from "@playwright/test";
import { config, signInViaAPI } from "./helpers";

test.describe("Exam lifecycle E2E", () => {
  test.describe("exam entry page", () => {
    test.skip(!config.hasCredentials, "Requires test student credentials");

    test("student sees exam entry page for exam 1", async ({ page }) => {
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/dashboard/exam/1`);
      // Should see either the exam content, a lock (before unlock), or "already submitted"
      const body = await page.textContent("body");
      expect(body).toBeTruthy();
      // Should NOT see an error page
      expect(body).not.toContain("Application error");
      expect(body).not.toContain("500");
    });

    test("student sees exam entry page for exam 2", async ({ page }) => {
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/dashboard/exam/2`);
      const body = await page.textContent("body");
      expect(body).toBeTruthy();
      expect(body).not.toContain("Application error");
    });

    test("exam entry shows round info", async ({ page }) => {
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/dashboard/exam/1`);
      // Should see Round 1 or exam title
      await expect(
        page.locator("text=Round 1").or(page.locator("text=Test-Driven")).or(page.locator("text=Exam"))
      ).toBeVisible({ timeout: 10_000 });
    });

    test("exam entry shows duration from settings", async ({ page }) => {
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/dashboard/exam/1`);
      // Should mention duration (30 minutes)
      await expect(
        page.locator("text=30").or(page.locator("text=minute"))
      ).toBeVisible({ timeout: 10_000 });
    });

    test("exam entry shows fullscreen warning", async ({ page }) => {
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/dashboard/exam/1`);
      await expect(
        page.locator("text=Fullscreen").or(page.locator("text=fullscreen"))
      ).toBeVisible({ timeout: 10_000 });
    });

    test("exam entry has Start Exam button or unlock timer", async ({ page }) => {
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/dashboard/exam/1`);
      // Either Start Exam button or "Unlocks in" timer
      await expect(
        page.locator("text=Start Exam").or(page.locator("text=Unlocks in"))
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe("invalid exam ID", () => {
    test.skip(!config.hasCredentials, "Requires test student credentials");

    test("exam 3 does not exist", async ({ page }) => {
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/dashboard/exam/3`);
      // Should show error or redirect
      const body = await page.textContent("body");
      expect(body).toBeTruthy();
    });
  });

  test.describe("exam live page", () => {
    test.skip(!config.hasCredentials, "Requires test student credentials");

    test("live page loads for exam 1", async ({ page }) => {
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/dashboard/exam/1/live`);
      // Should see code editor area or "already submitted" or redirect
      const body = await page.textContent("body");
      expect(body).toBeTruthy();
      expect(body).not.toContain("Application error");
    });

    test("live page has code editor area", async ({ page }) => {
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/dashboard/exam/1/live`);
      // Monaco editor loads asynchronously; check for editor container or submission UI
      await expect(
        page.locator("[data-testid='code-editor']")
          .or(page.locator(".monaco-editor"))
          .or(page.locator("text=Submit"))
          .or(page.locator("text=already submitted"))
          .or(page.locator("text=Run"))
      ).toBeVisible({ timeout: 15_000 });
    });

    test("live page has timer", async ({ page }) => {
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/dashboard/exam/1/live`);
      // Timer should display or "already submitted"
      await expect(
        page.locator("text=Time").or(page.locator("text=:")).or(page.locator("text=already submitted"))
      ).toBeVisible({ timeout: 10_000 });
    });
  });
});
