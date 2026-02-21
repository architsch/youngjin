import { test as base, Page } from "@playwright/test";

// The "setup" project in playwright.config.ts creates a guest session and saves
// cookies to e2e/.auth/guest.json. All tests in the "chromium" project inherit
// that storageState automatically. This fixture navigates to /mypage using those
// saved cookies, so no new guest user is created.

type AuthFixtures = {
    authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
    authenticatedPage: async ({ page }, use) => {
        await page.goto("/mypage", { waitUntil: "networkidle" });
        await use(page);
    },
});

export { expect } from "@playwright/test";
