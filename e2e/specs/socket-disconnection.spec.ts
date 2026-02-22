import { test, expect, CDPSession, Page } from "@playwright/test";
import { TIMEOUTS } from "../helpers/constants";
import { disconnectSocket } from "../fixtures/auth.fixture";

// These tests verify client-side disconnection handling behaviour.
// Because we run against a live staging server we cannot actually restart it,
// so server-initiated disconnects are simulated via Socket.IO internals while
// network-level disconnects use Chrome DevTools Protocol (CDP).

// Socket connections in these tests may take longer than usual because the
// server might need to clean up stale contexts from the previous test.
const DISCONNECT_TEST_SOCKET_TIMEOUT = 30_000;

/** Wait for the socket to be connected by watching console output. */
async function waitForSocketConnection(
    page: Page,
    consoleLogs: string[],
    timeout: number = TIMEOUTS.SOCKET_CONNECT,
): Promise<void> {
    const alreadyConnected = consoleLogs.some((l) =>
        l.includes("Successfully connected to game_sockets"),
    );
    if (alreadyConnected) return;

    await page.waitForEvent("console", {
        predicate: (msg) =>
            msg.text().includes("Successfully connected to game_sockets"),
        timeout,
    });
}

/**
 * Wait for the Socket.IO client instance to become available on the page.
 * This is needed after a page reload — the client bundle must finish loading
 * before `window.__socket_io_instance` is set.
 */
async function waitForSocketInstance(page: Page): Promise<void> {
    await page.waitForFunction(
        () => (window as any).__socket_io_instance != null,
        null,
        { timeout: DISCONNECT_TEST_SOCKET_TIMEOUT },
    );
}

test.describe("Socket Disconnection Handling", () => {
    // ------------------------------------------------------------------ //
    // Test 1 – Server-initiated disconnect (graceful shutdown simulation)
    // ------------------------------------------------------------------ //
    test.describe("Server-initiated disconnect", () => {
        test.afterEach(async ({ page }) => {
            // After the reload triggered by pollServerAndReload, wait for the
            // client bundle to load so disconnectSocket can actually find and
            // disconnect the socket. Without this, __socket_io_instance may
            // still be undefined and the disconnect is silently skipped,
            // leaving a stale session on the server.
            await waitForSocketInstance(page).catch(() => {});
            await disconnectSocket(page);
        });

        test("client polls the server and reloads when disconnected by the server", async ({
            page,
        }) => {
            const consoleLogs: string[] = [];
            page.on("console", (msg) => consoleLogs.push(msg.text()));

            await page.goto("/mypage", { waitUntil: "networkidle" });
            await waitForSocketConnection(page, consoleLogs);

            // 1. Intercept the polling HEAD requests at the Playwright network
            //    layer. Fail the first 2 attempts, then let the 3rd through.
            //    This simulates the server being briefly unavailable after a
            //    graceful shutdown before it comes back up.
            const pollUrls: string[] = [];
            let pollCount = 0;
            await page.route("**/*", (route) => {
                const request = route.request();
                if (request.method() === "HEAD") {
                    pollUrls.push(request.url());
                    pollCount++;
                    if (pollCount <= 2) {
                        route.abort("connectionrefused");
                        return;
                    }
                }
                route.continue();
            });

            // 2. Simulate an "io server disconnect" by triggering Socket.IO's
            //    internal disconnect listeners with the correct reason string.
            await page.evaluate(() => {
                const socket = (window as any).__socket_io_instance;
                if (!socket) throw new Error("Socket instance not found");

                // Update socket state so it looks genuinely disconnected.
                socket.connected = false;
                socket.disconnected = true;

                // Socket.IO client (component-emitter) stores listeners under
                // keys prefixed with '$'. Fire the disconnect listeners with the
                // reason the server would provide during graceful shutdown.
                const key = "$disconnect";
                const listeners = socket._callbacks && socket._callbacks[key];
                if (listeners) {
                    for (const fn of [...listeners]) {
                        fn.call(socket, "io server disconnect");
                    }
                }
            });

            // 3. Verify the console warning was logged.
            const disconnectLog = consoleLogs.find((l) =>
                l.includes(
                    "Socket disconnected (reason: io server disconnect)",
                ),
            );
            expect(disconnectLog).toBeTruthy();

            // 4. Wait for the page to reload. pollServerAndReload calls
            //    window.location.reload() once a HEAD request succeeds.
            //    After 2 failed polls (3 s each) + 1 success, the reload
            //    triggers a real navigation which Playwright can detect.
            await page.waitForEvent("load", { timeout: 20_000 });

            // 5. Verify that fetch polling occurred (at least the 2 failed +
            //    1 successful attempt).
            expect(pollUrls.length).toBeGreaterThanOrEqual(2);
        });
    });

    // ------------------------------------------------------------------ //
    // Test 2 – Network disconnect → successful auto-reconnection
    // ------------------------------------------------------------------ //
    test.describe("Network disconnect with auto-reconnection", () => {
        let cdp: CDPSession;

        test.afterEach(async ({ page }) => {
            // Ensure network is back on before teardown
            if (cdp) {
                await cdp
                    .send("Network.emulateNetworkConditions", {
                        offline: false,
                        latency: 0,
                        downloadThroughput: -1,
                        uploadThroughput: -1,
                    })
                    .catch(() => {});
                await cdp.detach().catch(() => {});
            }
            await disconnectSocket(page);
        });

        test("client reconnects automatically after a network drop", async ({
            page,
        }) => {
            const consoleLogs: string[] = [];
            page.on("console", (msg) => consoleLogs.push(msg.text()));

            await page.goto("/mypage", { waitUntil: "networkidle" });
            await waitForSocketConnection(
                page,
                consoleLogs,
                DISCONNECT_TEST_SOCKET_TIMEOUT,
            );

            // 1. Take the network offline via CDP.
            cdp = await page.context().newCDPSession(page);
            await cdp.send("Network.emulateNetworkConditions", {
                offline: true,
                latency: 0,
                downloadThroughput: 0,
                uploadThroughput: 0,
            });

            // 2. Wait for the disconnect to be detected.
            await page.waitForEvent("console", {
                predicate: (msg) =>
                    msg.text().includes("Socket disconnected"),
                timeout: 30_000,
            });

            // 3. Bring the network back online.
            await cdp.send("Network.emulateNetworkConditions", {
                offline: false,
                latency: 0,
                downloadThroughput: -1,
                uploadThroughput: -1,
            });

            // 4. Wait for successful reconnection.
            await page.waitForEvent("console", {
                predicate: (msg) =>
                    msg
                        .text()
                        .includes("Successfully connected to game_sockets"),
                timeout: 30_000,
            });

            // 5. Verify the reconnection log appeared after the disconnect log.
            const disconnectIndex = consoleLogs.findIndex((l) =>
                l.includes("Socket disconnected"),
            );
            const reconnectIndex = consoleLogs.findIndex(
                (l, i) =>
                    i > disconnectIndex &&
                    l.includes("Successfully connected to game_sockets"),
            );
            expect(reconnectIndex).toBeGreaterThan(disconnectIndex);
        });
    });

    // ------------------------------------------------------------------ //
    // Test 3 – Network disconnect → all reconnection attempts exhausted
    // ------------------------------------------------------------------ //
    test.describe("Network disconnect with reconnection failure", () => {
        let cdp: CDPSession;

        test.afterEach(async ({ page }) => {
            if (cdp) {
                await cdp
                    .send("Network.emulateNetworkConditions", {
                        offline: false,
                        latency: 0,
                        downloadThroughput: -1,
                        uploadThroughput: -1,
                    })
                    .catch(() => {});
                await cdp.detach().catch(() => {});
            }
            // After reconnect_failed the client reloads the page. Wait for
            // the socket instance to be available before disconnecting.
            await waitForSocketInstance(page).catch(() => {});
            await disconnectSocket(page);
        });

        test("client reloads the page after exhausting all reconnection attempts", async ({
            page,
        }) => {
            const consoleLogs: string[] = [];
            page.on("console", (msg) => consoleLogs.push(msg.text()));

            await page.goto("/mypage", { waitUntil: "networkidle" });
            await waitForSocketConnection(
                page,
                consoleLogs,
                DISCONNECT_TEST_SOCKET_TIMEOUT,
            );

            // 1. Reduce reconnection attempts and delays so the test finishes
            //    quickly.
            await page.evaluate(() => {
                const socket = (window as any).__socket_io_instance;
                if (!socket) throw new Error("Socket instance not found");

                // Socket.IO Manager (socket.io) exposes reconnection settings
                // via underscore-prefixed properties.
                const manager = socket.io;
                manager._reconnectionAttempts = 2;
                manager._reconnectionDelay = 500;
                manager._reconnectionDelayMax = 500;
            });

            // 2. Take the network offline.
            cdp = await page.context().newCDPSession(page);
            await cdp.send("Network.emulateNetworkConditions", {
                offline: true,
                latency: 0,
                downloadThroughput: 0,
                uploadThroughput: 0,
            });

            // 3. Wait for the "All reconnection attempts exhausted" message.
            await page.waitForEvent("console", {
                predicate: (msg) =>
                    msg
                        .text()
                        .includes("All reconnection attempts exhausted"),
                timeout: 30_000,
            });

            // 4. The client calls window.location.reload() after exhausting
            //    attempts. Detect the reload by waiting for the page's load
            //    event. Network is offline so the reload may fail — bring it
            //    back just before so the reload navigation can complete.
            await cdp.send("Network.emulateNetworkConditions", {
                offline: false,
                latency: 0,
                downloadThroughput: -1,
                uploadThroughput: -1,
            });

            await page.waitForEvent("load", { timeout: 20_000 });

            // 5. Verify the exhaustion log was present.
            const exhaustionLog = consoleLogs.find((l) =>
                l.includes("All reconnection attempts exhausted"),
            );
            expect(exhaustionLog).toBeTruthy();
        });
    });
});
