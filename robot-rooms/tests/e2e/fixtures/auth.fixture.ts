import { test as base, Page } from "@playwright/test";

// The "setup" project saves a guest session to tests/e2e/.auth/guest.json, inherited by all "chromium"
// tests; this fixture navigates with those cookies, so no new guest is created.

type AuthFixtures = {
    authenticatedPage: Page;
};

/** Disconnects the socket and waits for the server to notice, so no stale player stays in the room. */
async function disconnectSocket(page: Page): Promise<void> {
    if (page.isClosed())
        return;
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
    // Overrides `page` so every test gets socket cleanup on teardown; otherwise a ghost player lingers
    // until the stale-socket sweep (visible on staging between runs).
    page: async ({ page }, use) => {
        await use(page);
        await disconnectSocket(page);
    },
    authenticatedPage: async ({ page }, use) => {
        await page.goto("/", { waitUntil: "networkidle" });
        await use(page);
    },
});

export { disconnectSocket };

export { expect } from "@playwright/test";
