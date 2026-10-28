/** E2E: a page out of sight joins no room until it is shown (see AwayDisconnectUtil), since it runs no frames and a
 *  player arriving on it could not walk out of the door. Hidden is emulated as Chrome makes a page hidden: it reads
 *  "hidden", hears the event, and gets no animation frames until it is shown. */
import { Page } from "@playwright/test";
import { test, expect } from "../fixtures/auth.fixture";
import { TIMEOUTS } from "../helpers/constants";
import { isSocketConnected, waitForRoomLoaded } from "../helpers/game";

// Longer than Socket.IO's first retry after a drop takes to come (see SocketsClient.init).
const RETRY_WAIT_MS = 5000;

function emulateHiddenPage(startHidden: boolean): void
{
    const requestFrame = window.requestAnimationFrame.bind(window);
    const cancelFrame = window.cancelAnimationFrame.bind(window);
    let hidden = startHidden;
    let nextHeldId = -1;
    const held = new Map<number, FrameRequestCallback>();
    window.requestAnimationFrame = (callback) => {
        if (!hidden)
            return requestFrame(callback);
        held.set(nextHeldId, callback);
        return nextHeldId--;
    };
    window.cancelAnimationFrame = (id) => { if (id < 0) held.delete(id); else cancelFrame(id); };
    Object.defineProperty(document, "visibilityState", { get: () => hidden ? "hidden" : "visible", configurable: true });
    Object.defineProperty(document, "hidden", { get: () => hidden, configurable: true });
    (window as any).__setHidden = (newHidden: boolean) => {
        hidden = newHidden;
        document.dispatchEvent(new Event("visibilitychange"));
        if (!hidden)
        {
            const callbacks = [...held.values()];
            held.clear();
            callbacks.forEach(callback => requestFrame(callback));
        }
    };
}

async function setHidden(page: Page, hidden: boolean): Promise<void>
{
    await page.evaluate((h) => (window as any).__setHidden(h), hidden);
}

test.describe("Hidden page", () => {
    test("a page opened out of sight connects only once it is shown", async ({ page }) => {
        await page.addInitScript(emulateHiddenPage, true);
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => (window as any).__socket_io_instance != null, null,
            { timeout: TIMEOUTS.BUNDLE_LOAD });

        await page.waitForTimeout(RETRY_WAIT_MS);
        expect(await isSocketConnected(page)).toBe(false);

        await setHidden(page, false);
        await expect.poll(() => isSocketConnected(page), { timeout: TIMEOUTS.SOCKET_CONNECT }).toBe(true);
        await waitForRoomLoaded(page);
    });

    test("a page out of sight takes a dropped connection up again only once it is shown", async ({ page }) => {
        await page.addInitScript(emulateHiddenPage, false);
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await expect.poll(() => isSocketConnected(page), { timeout: TIMEOUTS.SOCKET_CONNECT }).toBe(true);
        await waitForRoomLoaded(page);

        // Dropped as the network would drop it, which Socket.IO takes up again by itself.
        await setHidden(page, true);
        await page.evaluate(() => (window as any).__socket_io_instance.io.engine.close());
        await page.waitForTimeout(RETRY_WAIT_MS);
        expect(await isSocketConnected(page)).toBe(false);

        await setHidden(page, false);
        await expect.poll(() => isSocketConnected(page), { timeout: TIMEOUTS.SOCKET_CONNECT }).toBe(true);
        await waitForRoomLoaded(page);
    });
});
