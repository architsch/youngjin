/** E2E helpers for waiting on game state and querying it via page.evaluate (wrapping client globals). */
import { Page, expect } from "@playwright/test";
import { LOADING_INDICATOR_TEXT, SELECTORS, TIMEOUTS } from "./constants";

// ─── Game Initialization ────────────────────────────────────────────────

/** Wait for the game to be fully initialized (socket connected + room loaded). */
export async function waitForGameReady(page: Page): Promise<void>
{
    // Wait for the socket connection log
    const consoleLogs: string[] = [];
    const logHandler = (msg: any) => consoleLogs.push(msg.text());
    page.on("console", logHandler);

    // Check if already connected
    const alreadyConnected = await page.evaluate(() => {
        const io = (window as any).__socket_io_instance;
        return io && io.connected;
    }).catch(() => false);

    if (!alreadyConnected)
    {
        await page.waitForEvent("console", {
            predicate: (msg) => msg.text().includes("Successfully connected to socket server"),
            timeout: TIMEOUTS.SOCKET_CONNECT,
        });
    }

    page.off("console", logHandler);
}

/** Waits until the client is in a room: the loading indicator clears only after roomChangedSignal is applied. */
export async function waitForRoomLoaded(page: Page): Promise<void>
{
    await expect(page.locator(SELECTORS.UI_ROOT).getByText(LOADING_INDICATOR_TEXT, { exact: true }))
        .toBeHidden({ timeout: TIMEOUTS.ROOM_LOAD });
}

/** Wait for the Socket.IO instance to exist on the page. */
export async function waitForSocketInstance(page: Page): Promise<void>
{
    await page.waitForFunction(
        () => (window as any).__socket_io_instance != null,
        null,
        { timeout: TIMEOUTS.SOCKET_CONNECT },
    );
}

// ─── Game State Queries ─────────────────────────────────────────────────

/** Returns true if the socket is currently connected. */
export async function isSocketConnected(page: Page): Promise<boolean>
{
    return page.evaluate(() => {
        const io = (window as any).__socket_io_instance;
        return io ? io.connected === true : false;
    });
}

/** Returns the injected environment config from the page. */
export async function getGameEnv(page: Page): Promise<Record<string, any> | null>
{
    return page.evaluate(() => (window as any).thingspool_env ?? null);
}

// ─── Console Log Capture ────────────────────────────────────────────────

/**
 * Console capture: `logs`, `errors`, `stop()`, `find(sub)`, `findAll(sub)`, `waitFor(sub, timeout)`.
 */
export function captureConsole(page: Page)
{
    const logs: string[] = [];
    const errors: string[] = [];

    const handler = (msg: any) => {
        const text = msg.text();
        if (msg.type() === "error")
            errors.push(text);
        else
            logs.push(text);
    };

    page.on("console", handler);

    return {
        logs,
        errors,
        stop: () => page.off("console", handler),
        find: (sub: string) => logs.find(l => l.includes(sub)),
        findAll: (sub: string) => logs.filter(l => l.includes(sub)),
        waitFor: async (sub: string, timeout: number = TIMEOUTS.SOCKET_CONNECT): Promise<void> => {
            // Check the buffer first: the message may have been logged before waitFor was called.
            if (logs.some(l => l.includes(sub)) || errors.some(e => e.includes(sub)))
                return;
            await page.waitForEvent("console", {
                predicate: (msg) => msg.text().includes(sub),
                timeout,
            });
        },
    };
}
