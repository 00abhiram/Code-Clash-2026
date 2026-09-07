import { test, expect } from "@playwright/test";
import { config } from "./helpers";

test.describe("Public pages smoke tests", () => {
  test("homepage loads", async ({ page }) => {
    const response = await page.goto(config.baseUrl);
    expect(response?.status()).toBe(200);
    const body = await page.textContent("body");
    expect(body).toContain("Code Clash");
  });

  test("login page loads", async ({ page }) => {
    await page.goto(`${config.baseUrl}/login`);
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });

  test("signup page loads", async ({ page }) => {
    await page.goto(`${config.baseUrl}/signup`);
    await expect(page.getByRole("button", { name: "Sign Up" })).toBeVisible();
  });

  test("login page has email and password fields", async ({ page }) => {
    await page.goto(`${config.baseUrl}/login`);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("signup page has required fields", async ({ page }) => {
    await page.goto(`${config.baseUrl}/signup`);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Confirm Password" })).toBeVisible();
  });

  test("login page has Google OAuth button", async ({ page }) => {
    await page.goto(`${config.baseUrl}/login`);
    const googleBtn = page.locator("text=Google").or(page.locator("[data-provider='google']"));
    await expect(googleBtn).toBeVisible();
  });

  test("unauthenticated user redirected from dashboard", async ({ page }) => {
    await page.goto(`${config.baseUrl}/dashboard`);
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated user redirected from admin", async ({ page }) => {
    await page.goto(`${config.baseUrl}/admin`);
    expect(page.url()).toContain("/login");
  });

  test("login page has link to signup", async ({ page }) => {
    await page.goto(`${config.baseUrl}/login`);
    const signupLink = page.locator("a").filter({ hasText: /sign up|register|create/i });
    await expect(signupLink).toBeVisible();
  });

  test("signup page has link to login", async ({ page }) => {
    await page.goto(`${config.baseUrl}/signup`);
    const loginLink = page.locator("a").filter({ hasText: /sign in|log in|login/i });
    await expect(loginLink).toBeVisible();
  });
});
