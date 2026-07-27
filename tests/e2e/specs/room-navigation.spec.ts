/**
 * E2E tests: Room Navigation
 *
 * Verifies that the client can:
 * - Load into a default room when visiting /
 * - Navigate to a specific room via /:roomID URL
 * - Handle navigation to a non-existent room gracefully
 * - Maintain socket connection after room load
 */
import { test, expect } from "../fixtures/auth.fixture";
import { TIMEOUTS } from "../helpers/constants";
import { waitForGameReady, waitForRoomLoaded, isSocketConnected, captureConsole } from "../helpers/game";

test.describe("Room Navigation", () => {
    test("visiting / loads a default room and establishes socket", async ({ authenticatedPage }) => {
        await waitForGameReady(authenticatedPage);
        const connected = await isSocketConnected(authenticatedPage);
        expect(connected).toBe(true);

        // The server picks the room on the user's behalf here, so reaching a loaded room is
        // what proves the pick resolved to a room that could actually take the user.
        await waitForRoomLoaded(authenticatedPage);
    });

    test("visiting /:roomID with a non-existent room ID falls back to a room that exists", async ({ page }) => {
        const console = captureConsole(page);

        await page.goto("/this-room-does-not-exist-12345", { waitUntil: "networkidle" });

        // The page should still load (server falls back to a Hub room)
        const response = await page.evaluate(() => document.readyState);
        expect(response).toBe("complete");

        // Socket should eventually connect (server redirects to fallback room)
        await console.waitFor("Successfully connected to socket server", TIMEOUTS.ROOM_LOAD);

        // A room ID carried in the URL is a destination the server routed the user to rather
        // than one they asked for by name, so an unusable one must hand them to a hub instead
        // of leaving them stuck behind the loading indicator forever.
        await waitForRoomLoaded(page);

        console.stop();

        // Filter for critical errors (excluding favicon and 404 noise)
        const criticalErrors = console.errors.filter(
            (e) => !e.includes("favicon") && !e.includes("404"),
        );
        expect(criticalErrors).toHaveLength(0);
    });

    test("game environment is consistent between / loads", async ({ page }) => {
        // First load
        await page.goto("/", { waitUntil: "networkidle" });
        const env1 = await page.evaluate(() => (window as any).thingspool_env);

        // Navigate away and back
        await page.goto("about:blank");
        await page.goto("/", { waitUntil: "networkidle" });
        const env2 = await page.evaluate(() => (window as any).thingspool_env);

        // Core environment variables should be consistent
        expect(env1?.mode).toBe(env2?.mode);
        expect(env1?.socket_server_url).toBe(env2?.socket_server_url);
        expect(env1?.serverType).toBe(env2?.serverType);
    });
});
