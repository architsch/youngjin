/**
 * E2E tests: Room Navigation
 *
 * Verifies that the client can:
 * - Load into a default room when visiting /mypage
 * - Navigate to a specific room via /mypage/:roomID URL
 * - Handle navigation to a non-existent room gracefully
 * - Maintain socket connection after room load
 */
import { test, expect } from "../fixtures/auth.fixture";
import { TIMEOUTS } from "../helpers/constants";
import { waitForGameReady, isSocketConnected, captureConsole } from "../helpers/game";

// Room load involves socket communication + room data transfer, so use a generous timeout.
const ROOM_LOAD_TIMEOUT = 30_000;

test.describe("Room Navigation", () => {
    test("visiting /mypage loads a default room and establishes socket", async ({ authenticatedPage }) => {
        await waitForGameReady(authenticatedPage);
        const connected = await isSocketConnected(authenticatedPage);
        expect(connected).toBe(true);
    });

    test("visiting /mypage/:roomID with a non-existent room ID still loads the game", async ({ page }) => {
        const console = captureConsole(page);

        await page.goto("/mypage/this-room-does-not-exist-12345", { waitUntil: "networkidle" });

        // The page should still load (server falls back to a Hub room)
        const response = await page.evaluate(() => document.readyState);
        expect(response).toBe("complete");

        // Socket should eventually connect (server redirects to fallback room)
        await console.waitFor("Successfully connected to socket server", ROOM_LOAD_TIMEOUT);

        console.stop();

        // Filter for critical errors (excluding favicon and 404 noise)
        const criticalErrors = console.errors.filter(
            (e) => !e.includes("favicon") && !e.includes("404"),
        );
        expect(criticalErrors).toHaveLength(0);
    });

    test("game environment is consistent between /mypage loads", async ({ page }) => {
        // First load
        await page.goto("/mypage", { waitUntil: "networkidle" });
        const env1 = await page.evaluate(() => (window as any).thingspool_env);

        // Navigate away and back
        await page.goto("about:blank");
        await page.goto("/mypage", { waitUntil: "networkidle" });
        const env2 = await page.evaluate(() => (window as any).thingspool_env);

        // Core environment variables should be consistent
        expect(env1?.mode).toBe(env2?.mode);
        expect(env1?.socket_server_url).toBe(env2?.socket_server_url);
        expect(env1?.serverType).toBe(env2?.serverType);
    });
});
