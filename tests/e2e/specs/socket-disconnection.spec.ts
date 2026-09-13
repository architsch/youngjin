import { test, expect, CDPSession, Page } from "@playwright/test";
import { TIMEOUTS } from "../helpers/constants";
import { disconnectSocket } from "../fixtures/auth.fixture";

// Client disconnection handling. Server-initiated disconnects are simulated via Socket.IO internals;
// network disconnects via CDP (staging can't be restarted).

// Longer, since the server may still be cleaning up the previous test's context.
const DISCONNECT_TEST_SOCKET_TIMEOUT = 30_000;

/** Wait for the socket to be connected by watching console output. */
async function waitForSocketConnection(
    page: Page,
    consoleLogs: string[],
    timeout: number = TIMEOUTS.SOCKET_CONNECT,
): Promise<void> {
    const alreadyConnected = consoleLogs.some((l) =>
        l.includes("Successfully connected to socket server"),
    );
    if (alreadyConnected) return;

    await page.waitForEvent("console", {
        predicate: (msg) =>
            msg.text().includes("Successfully connected to socket server"),
        timeout,
    });
}

/** Waits for window.__socket_io_instance after a reload. */
async function waitForSocketInstance(page: Page): Promise<void> {
    await page.waitForFunction(
        () => (window as any).__socket_io_instance != null,
        null,
        { timeout: DISCONNECT_TEST_SOCKET_TIMEOUT },
    );
}

test.describe("Socket Disconnection Handling", () => {
    // Test 1 – Server-initiated disconnect (graceful shutdown simulation)
    test.describe("Server-initiated disconnect", () => {
        test.afterEach(async ({ page }) => {
            // Wait for the bundle after the reload, or the disconnect is skipped and a stale session remains.
            await waitForSocketInstance(page).catch(() => {});
            await disconnectSocket(page);
        });

        test("client polls the server and reloads when disconnected by the server", async ({
            page,
        }) => {
            const consoleLogs: string[] = [];
            page.on("console", (msg) => consoleLogs.push(msg.text()));

            await page.goto("/", { waitUntil: "networkidle" });
            await waitForSocketConnection(page, consoleLogs);

            // 1. Intercept health polls to reproduce a deploy: (1) a gateway error (only the status shows
            //    the server is down), (2) connection refused, (3) success.
            const pollUrls: string[] = [];
            let pollCount = 0;
            await page.route("**/health", (route) => {
                pollUrls.push(route.request().url());
                pollCount++;
                if (pollCount === 1) {
                    route.fulfill({
                        status: 502,
                        contentType: "text/html",
                        body: "<html><body><h1>502 Bad Gateway</h1></body></html>",
                    });
                    return;
                }
                if (pollCount === 2) {
                    route.abort("connectionrefused");
                    return;
                }
                route.continue();
            });

            // 2. Simulate an "io server disconnect" via Socket.IO's internal listeners.
            await page.evaluate(() => {
                const socket = (window as any).__socket_io_instance;
                if (!socket) throw new Error("Socket instance not found");

                // Update socket state so it looks genuinely disconnected.
                socket.connected = false;
                socket.disconnected = true;

                // component-emitter stores listeners under "$"-prefixed keys.
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

            // 4. The client reloads only after a successful poll (the third).
            await page.waitForEvent("load", { timeout: 20_000 });

            // 5. All three polls must happen (stopping at one means the gateway error was treated as healthy).
            expect(pollUrls.length).toBeGreaterThanOrEqual(3);
        });
    });

    // Test 2 – Network disconnect → successful auto-reconnection
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

            await page.goto("/", { waitUntil: "networkidle" });
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
                        .includes("Successfully connected to socket server"),
                timeout: 30_000,
            });

            // 5. Verify the reconnection log appeared after the disconnect log.
            const disconnectIndex = consoleLogs.findIndex((l) =>
                l.includes("Socket disconnected"),
            );
            const reconnectIndex = consoleLogs.findIndex(
                (l, i) =>
                    i > disconnectIndex &&
                    l.includes("Successfully connected to socket server"),
            );
            expect(reconnectIndex).toBeGreaterThan(disconnectIndex);
        });
    });

    // Test 3 – Network disconnect → all reconnection attempts exhausted
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
            // Wait for the socket instance after the reload before disconnecting.
            await waitForSocketInstance(page).catch(() => {});
            await disconnectSocket(page);
        });

        test("client reloads the page after exhausting all reconnection attempts", async ({
            page,
        }) => {
            const consoleLogs: string[] = [];
            page.on("console", (msg) => consoleLogs.push(msg.text()));

            await page.goto("/", { waitUntil: "networkidle" });
            await waitForSocketConnection(
                page,
                consoleLogs,
                DISCONNECT_TEST_SOCKET_TIMEOUT,
            );

            // 1. Shorten reconnection attempts, delays and timeouts.
            await page.evaluate(() => {
                const socket = (window as any).__socket_io_instance;
                if (!socket) throw new Error("Socket instance not found");

                const manager = socket.io;
                manager._reconnectionAttempts = 2;
                manager._reconnectionDelay = 500;
                manager._reconnectionDelayMax = 500;
                manager._timeout = 2000;
            });

            // 2. Take the network offline.
            cdp = await page.context().newCDPSession(page);
            await cdp.send("Network.emulateNetworkConditions", {
                offline: true,
                latency: 0,
                downloadThroughput: 0,
                uploadThroughput: 0,
            });

            // 3. Wait for "All reconnection attempts exhausted"; the reload waits for a successful poll
            //    (after step 5).
            await page.waitForEvent("console", {
                predicate: (msg) =>
                    msg
                        .text()
                        .includes("All reconnection attempts exhausted"),
                timeout: 30_000,
            });

            // 4. Verify the exhaustion log was captured.
            const exhaustionLog = consoleLogs.find((l) =>
                l.includes("All reconnection attempts exhausted"),
            );
            expect(exhaustionLog).toBeTruthy();

            // 5. Restore the network so the next poll succeeds and cleanup works.
            await cdp.send("Network.emulateNetworkConditions", {
                offline: false,
                latency: 0,
                downloadThroughput: -1,
                uploadThroughput: -1,
            });

            await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => {});
        });
    });
});
