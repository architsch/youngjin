/**
 * E2E: room lighting end to end. Guards the wire format: prefs are encoded before voxels and objects,
 * so a misplaced field corrupts everything after it. Only a real socket round trip and render catch this.
 */
import { test, expect } from "../fixtures/auth.fixture";
import { SELECTORS, TIMEOUTS } from "../helpers/constants";
import { waitForGameReady, waitForRoomLoaded, captureConsole } from "../helpers/game";

// Written out (not imported), to check what arrived rather than what the bundle believes.
const MAX_ROOM_PREFS_STEP = 93;

interface RoomLighting
{
    ambientColorIndex: number;
    headLightColorIndex: number;
    headLightPowerStep: number;
    fogColorIndex: number;
    fogNearStep: number;
    fogFarStep: number;
}

async function readLighting(page: any): Promise<RoomLighting>
{
    await page.waitForFunction(
        () => (window as any).__thingspool_automation?.context()?.room != null,
        { timeout: TIMEOUTS.ROOM_LOAD });
    return await page.evaluate(
        () => (window as any).__thingspool_automation.context().room.lighting);
}

test.describe("Room Lighting", () => {
    test("a room arrives carrying lighting the client can read", async ({ authenticatedPage }) => {
        await waitForGameReady(authenticatedPage);
        await waitForRoomLoaded(authenticatedPage);

        const lighting = await readLighting(authenticatedPage);

        // Undefined or NaN fields mean the wire format is out of step.
        for (const [name, value] of Object.entries(lighting))
        {
            expect(Number.isInteger(value), `${name} is not a whole number`).toBe(true);
            expect(value, `${name} is below its range`).toBeGreaterThanOrEqual(0);
            expect(value, `${name} is above its range`).toBeLessThanOrEqual(MAX_ROOM_PREFS_STEP);
        }
    });

    test("the room the server hands out still decodes past its lighting", async ({ authenticatedPage }) => {
        await waitForGameReady(authenticatedPage);
        await waitForRoomLoaded(authenticatedPage);

        // Contents arriving proves the prefs field was read at the right width (every room has a door).
        const ready = await authenticatedPage.evaluate(
            () => (window as any).__thingspool_automation.ready());
        expect(ready.room).toBe(true);
        expect(ready.objectCount).toBeGreaterThan(0);
    });

    test("drawing a lit room raises nothing", async ({ authenticatedPage }) => {
        // Light field or fog shader errors surface as console errors (link failures).
        const console_ = captureConsole(authenticatedPage);

        await waitForGameReady(authenticatedPage);
        await waitForRoomLoaded(authenticatedPage);
        await expect(authenticatedPage.locator(SELECTORS.THREE_CANVAS))
            .toBeVisible({ timeout: TIMEOUTS.CANVAS_RENDER });
        await authenticatedPage.waitForTimeout(2000);

        console_.stop();

        const criticalErrors = console_.errors.filter(
            (e) => !e.includes("favicon") && !e.includes("404"));
        expect(criticalErrors).toHaveLength(0);
    });
});
