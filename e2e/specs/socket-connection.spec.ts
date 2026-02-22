import { test, expect } from "@playwright/test";
import { TIMEOUTS } from "../helpers/constants";
import { disconnectSocket } from "../fixtures/auth.fixture";

// Socket tests need to capture console events BEFORE the page navigates,
// because the socket connection log fires during page load. We use `page`
// directly (with storageState cookies from setup) instead of the
// authenticatedPage fixture.

test.afterEach(async ({ page }) => {
    await disconnectSocket(page);
});

test.describe("Socket.IO Connection", () => {
    test("client establishes socket connection to game_sockets", async ({ page }) => {
        const consoleLogs: string[] = [];
        page.on("console", (msg) => consoleLogs.push(msg.text()));

        await page.goto("/mypage", { waitUntil: "networkidle" });

        // Check if the connection log appeared during page load
        const connectionLog = consoleLogs.find((log) =>
            log.includes("Successfully connected to game_sockets")
        );

        if (connectionLog) {
            expect(connectionLog).toContain("Successfully connected to game_sockets");
            return;
        }

        // If not yet connected, wait a bit longer
        const connectionMessage = await page.waitForEvent("console", {
            predicate: (msg) =>
                msg.text().includes("Successfully connected to game_sockets"),
            timeout: TIMEOUTS.SOCKET_CONNECT,
        });
        expect(connectionMessage.text()).toContain("Successfully connected to game_sockets");
    });

    test("socket connection uses websocket transport", async ({ page }) => {
        const consoleLogs: string[] = [];
        page.on("console", (msg) => consoleLogs.push(msg.text()));

        await page.goto("/mypage", { waitUntil: "networkidle" });

        const connectionLog = consoleLogs.find((log) =>
            log.includes("Successfully connected to game_sockets")
        );

        if (connectionLog) {
            expect(connectionLog).toContain("transport: websocket");
            return;
        }

        const connectionMessage = await page.waitForEvent("console", {
            predicate: (msg) =>
                msg.text().includes("Successfully connected to game_sockets"),
            timeout: TIMEOUTS.SOCKET_CONNECT,
        });
        expect(connectionMessage.text()).toContain("transport: websocket");
    });
});
