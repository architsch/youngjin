/**
 * Game state helpers for E2E tests.
 *
 * Provides reusable utilities for waiting on game initialization,
 * querying in-game state, and performing common gameplay actions
 * via Playwright page.evaluate().
 *
 * These helpers abstract over the client-side globals exposed by the
 * game bundle (e.g. window.__socket_io_instance) so that individual
 * specs stay concise and don't duplicate low-level evaluate calls.
 */
import { Page, expect } from "@playwright/test";
import { TIMEOUTS } from "./constants";

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
 * Creates a console log capture context. Returns an object with:
 * - `logs`: array of captured log strings
 * - `errors`: array of captured error strings
 * - `stop()`: removes the listener
 * - `find(substring)`: finds the first log containing the substring
 * - `findAll(substring)`: finds all logs containing the substring
 * - `waitFor(substring, timeout)`: waits for a log containing the substring
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
            // The target message may already have been emitted before waitFor was
            // called — e.g. during a page.goto({ waitUntil: "networkidle" }) that
            // settles only after the socket connects. The handler above buffers every
            // console message since capture start, so check that buffer first and fall
            // back to waiting for a future event only if it hasn't appeared yet.
            if (logs.some(l => l.includes(sub)) || errors.some(e => e.includes(sub)))
                return;
            await page.waitForEvent("console", {
                predicate: (msg) => msg.text().includes(sub),
                timeout,
            });
        },
    };
}
