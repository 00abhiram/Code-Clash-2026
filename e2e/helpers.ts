import { expect, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TEST_STUDENT_EMAIL = process.env.TEST_STUDENT_EMAIL || "";
const TEST_STUDENT_PASSWORD = process.env.TEST_STUDENT_PASSWORD || "";
const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "";
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "";

export const config = {
  baseUrl: BASE_URL,
  student: { email: TEST_STUDENT_EMAIL, password: TEST_STUDENT_PASSWORD },
  admin: { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD },
  hasCredentials: !!(TEST_STUDENT_EMAIL && TEST_STUDENT_PASSWORD),
  hasAdminCredentials: !!(TEST_ADMIN_EMAIL && TEST_ADMIN_PASSWORD),
};

/**
 * Sign in via Supabase GoTrue API directly and set the session cookie.
 * This bypasses the login UI for faster, more reliable test setup.
 */
export async function signInViaAPI(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  // Sign in via Supabase GoTrue REST API
  const response = await page.request.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      headers: {
        apikey: supabaseKey,
        "Content-Type": "application/json",
      },
      data: { email, password },
    }
  );

  const body = await response.json();

  if (body.access_token && body.refresh_token) {
    // Set cookies that the Next.js Supabase SSR client reads
    const cookieDomain = new URL(BASE_URL).hostname;
    await page.context().addCookies([
      {
        name: "sb-access-token",
        value: body.access_token,
        domain: cookieDomain,
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
      {
        name: "sb-refresh-token",
        value: body.refresh_token,
        domain: cookieDomain,
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);
  }
}

/**
 * Sign out via Supabase GoTrue API.
 */
export async function signOutViaAPI(page: Page): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const cookies = await page.context().cookies();
  const accessToken = cookies.find((c) => c.name === "sb-access-token")?.value;

  if (accessToken) {
    await page.request.post(`${supabaseUrl}/auth/v1/logout`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  await page.context().clearCookies();
}

/**
 * Navigate to a page and check it loads without errors.
 */
export async function assertPageLoads(page: Page, path: string, opts?: { title?: string; status?: number }) {
  const response = await page.goto(`${BASE_URL}${path}`);
  if (opts?.status) {
    expect(response?.status()).toBe(opts.status);
  }
  if (opts?.title) {
    await expect(page).toHaveTitle(new RegExp(opts.title, "i"));
  }
}

/**
 * Check that the page does not show error states.
 */
export async function assertNoErrorPage(page: Page) {
  const text = await page.textContent("body");
  expect(text).not.toContain("Application error");
  expect(text).not.toContain("500");
  expect(text).not.toContain("Internal Server Error");
}
