import { test, expect } from "@playwright/test";
import { config } from "./helpers";

test.describe("Security E2E", () => {
  test.describe("route protection", () => {
    test("unauthenticated user cannot reach dashboard", async ({ page }) => {
      await page.goto(`${config.baseUrl}/dashboard`);
      expect(page.url()).toContain("/login");
    });

    test("unauthenticated user cannot reach admin", async ({ page }) => {
      await page.goto(`${config.baseUrl}/admin`);
      expect(page.url()).toContain("/login");
    });

    test("unauthenticated user cannot reach admin settings", async ({ page }) => {
      await page.goto(`${config.baseUrl}/admin/settings`);
      expect(page.url()).toContain("/login");
    });

    test("unauthenticated user cannot reach exam live page", async ({ page }) => {
      await page.goto(`${config.baseUrl}/dashboard/exam/1/live`);
      expect(page.url()).toContain("/login");
    });
  });

  test.describe("API security", () => {
    test("GET /api/settings requires auth", async ({ request }) => {
      const response = await request.get(`${config.baseUrl}/api/settings`);
      expect(response.status()).toBe(401);
    });

    test("GET /api/leaderboard requires auth", async ({ request }) => {
      const response = await request.get(`${config.baseUrl}/api/leaderboard?exam=1`);
      expect(response.status()).toBe(401);
    });

    test("POST /api/exam-sessions requires auth", async ({ request }) => {
      const response = await request.post(`${config.baseUrl}/api/exam-sessions`, { data: {} });
      expect(response.status()).toBe(401);
    });

    test("POST /api/execute requires auth", async ({ request }) => {
      const response = await request.post(`${config.baseUrl}/api/execute`, { data: {} });
      expect(response.status()).toBe(401);
    });

    test("POST /api/submissions/evaluate requires auth", async ({ request }) => {
      const response = await request.post(`${config.baseUrl}/api/submissions/evaluate`, { data: {} });
      expect(response.status()).toBe(401);
    });

    test("POST /api/violations requires auth", async ({ request }) => {
      const response = await request.post(`${config.baseUrl}/api/violations`, { data: {} });
      expect(response.status()).toBe(401);
    });

    test("POST /api/questions requires auth", async ({ request }) => {
      const response = await request.post(`${config.baseUrl}/api/questions`, { data: {} });
      expect(response.status()).toBe(401);
    });

    test("GET /api/questions requires auth", async ({ request }) => {
      const response = await request.get(`${config.baseUrl}/api/questions`);
      expect(response.status()).toBe(401);
    });

    test("dead POST /api/submissions returns 410", async ({ request }) => {
      const response = await request.post(`${config.baseUrl}/api/submissions`, { data: {} });
      expect(response.status()).toBe(410);
    });
  });

  test.describe("student cannot access admin", () => {
    test.skip(!config.hasCredentials, "Requires test student credentials");

    test("student redirected from /admin", async ({ page }) => {
      const { signInViaAPI } = await import("./helpers");
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/admin`);
      expect(page.url()).not.toContain("/admin");
    });

    test("student redirected from /admin/settings", async ({ page }) => {
      const { signInViaAPI } = await import("./helpers");
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/admin/settings`);
      expect(page.url()).not.toContain("/admin");
    });

    test("student redirected from /admin/questions", async ({ page }) => {
      const { signInViaAPI } = await import("./helpers");
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/admin/questions`);
      expect(page.url()).not.toContain("/admin");
    });

    test("student redirected from /admin/leaderboard", async ({ page }) => {
      const { signInViaAPI } = await import("./helpers");
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/admin/leaderboard`);
      expect(page.url()).not.toContain("/admin");
    });
  });

  test.describe("data leak prevention in browser", () => {
    test.skip(!config.hasCredentials, "Requires test student credentials");

    test("student dashboard does not show solution_code", async ({ page }) => {
      const { signInViaAPI } = await import("./helpers");
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/dashboard`);
      const body = await page.textContent("body");
      expect(body).not.toContain("solution_code");
      expect(body).not.toContain("solutionCode");
    });

    test("exam page does not leak hidden test data", async ({ page }) => {
      const { signInViaAPI } = await import("./helpers");
      await signInViaAPI(page, config.student.email, config.student.password);
      await page.goto(`${config.baseUrl}/dashboard/exam/1`);
      const body = await page.textContent("body");
      expect(body).not.toContain("expected_stdout");
      expect(body).not.toContain("is_sample");
    });
  });
});
