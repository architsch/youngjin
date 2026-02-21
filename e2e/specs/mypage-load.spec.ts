import { test, expect } from "../fixtures/auth.fixture";
import { SELECTORS, TIMEOUTS } from "../helpers/constants";

test.describe("Main Page (/mypage)", () => {
    test("page loads and returns 200", async ({ page }) => {
        const response = await page.goto("/mypage", { waitUntil: "domcontentloaded" });
        expect(response?.status()).toBe(200);
    });

    test("page renders game containers", async ({ authenticatedPage }) => {
        await expect(authenticatedPage.locator(SELECTORS.GAME_CANVAS_ROOT))
            .toBeVisible({ timeout: TIMEOUTS.BUNDLE_LOAD });
        await expect(authenticatedPage.locator(SELECTORS.UI_ROOT))
            .toBeAttached();
        await expect(authenticatedPage.locator(SELECTORS.OVERLAY_CANVAS_ROOT))
            .toBeAttached();
    });

    test("client bundle loads without errors", async ({ authenticatedPage }) => {
        const consoleErrors: string[] = [];
        authenticatedPage.on("console", (msg) => {
            if (msg.type() === "error") {
                consoleErrors.push(msg.text());
            }
        });

        await expect(authenticatedPage.locator('script[src*="bundle.js"]'))
            .toBeAttached({ timeout: TIMEOUTS.BUNDLE_LOAD });

        // Give the bundle time to execute
        await authenticatedPage.waitForTimeout(5000);

        // Filter out known non-critical errors (e.g., favicon 404)
        const criticalErrors = consoleErrors.filter(
            (e) => !e.includes("favicon") && !e.includes("404")
        );
        expect(criticalErrors).toHaveLength(0);
    });

    test("thingspool_env is injected into window", async ({ authenticatedPage }) => {
        const env = await authenticatedPage.evaluate(() => (window as any).thingspool_env);
        expect(env).toBeTruthy();
        expect(env.mode).toBeTruthy();
        expect(env.socket_server_url).toContain("staging.thingspool.net");
        expect(env.serverType).toBe("Staging");
    });
});
