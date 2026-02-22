import { test as base, Page } from "@playwright/test";

// The "setup" project in playwright.config.ts creates a guest session and saves
// cookies to e2e/.auth/guest.json. All tests in the "chromium" project inherit
// that storageState automatically. This fixture navigates to /mypage using those
// saved cookies, so no new guest user is created.

type AuthFixtures = {
    authenticatedPage: Page;
};

/**
 * Explicitly disconnect the Socket.IO client and wait for the server to
 * acknowledge the disconnection. Without this, the browser page may close
 * before the server detects the TCP drop, leaving stale players in the room.
 */
async function disconnectSocket(page: Page): Promise<void> {
    await page.evaluate(() => {
        return new Promise<void>((resolve) => {
            const io = (window as any).__socket_io_instance;
            if (!io || io.disconnected) {
                resolve();
                return;
            }
            io.on("disconnect", () => resolve());
            io.disconnect();
            // Safety timeout in case the disconnect event never fires
            setTimeout(resolve, 3000);
        });
    }).catch(() => {
        // Page may already be closed; ignore errors
    });
}

export const test = base.extend<AuthFixtures>({
    authenticatedPage: async ({ page }, use) => {
        await page.goto("/mypage", { waitUntil: "networkidle" });
        await use(page);
        await disconnectSocket(page);
    },
});

export { disconnectSocket };

export { expect } from "@playwright/test";
