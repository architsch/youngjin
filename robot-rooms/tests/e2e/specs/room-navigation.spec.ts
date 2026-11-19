/** E2E: loading the default room, /:roomID navigation, nonexistent rooms, and socket persistence. */
import { test, expect } from "../fixtures/auth.fixture";
import { TIMEOUTS } from "../helpers/constants";
import { waitForGameReady, waitForRoomLoaded, isSocketConnected, captureConsole } from "../helpers/game";

test.describe("Room Navigation", () => {
    test("visiting / loads a default room and establishes socket", async ({ authenticatedPage }) => {
        await waitForGameReady(authenticatedPage);
        const connected = await isSocketConnected(authenticatedPage);
        expect(connected).toBe(true);

        // Reaching a loaded room proves the server's pick could take the user.
        await waitForRoomLoaded(authenticatedPage);
    });

    test("visiting /:roomID with a non-existent room ID falls back to a room that exists", async ({ page }) => {
        const console = captureConsole(page);

        // Well-formed but unclaimed (malformed ids 404 earlier), like a link to a deleted room.
        await page.goto("/nonexistentRoom00001", { waitUntil: "networkidle" });

        // The page should still load (server falls back to a Hub room)
        const response = await page.evaluate(() => document.readyState);
        expect(response).toBe("complete");

        // Socket should eventually connect (server redirects to fallback room)
        await console.waitFor("Successfully connected to socket server", TIMEOUTS.ROOM_LOAD);

        // A URL room is server-routed, so an unusable one must fall back to a hub.
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
