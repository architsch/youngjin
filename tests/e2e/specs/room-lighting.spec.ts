/**
 * E2E tests: a room's lighting, end to end
 *
 * What these are actually guarding is the wire format. A room's atmosphere is a field on the room,
 * and it sits ahead of the room's voxels and objects in the encoding — so getting its position
 * wrong does not lose the lighting, it corrupts everything read after it, and the room fails to
 * arrive at all. Nothing in the integration suite can catch that, because nothing there sends a
 * room over a socket and draws it.
 *
 * So: the room arrives, it carries lighting the client can read, and drawing it under that lighting
 * raises nothing.
 */
import { test, expect } from "../fixtures/auth.fixture";
import { SELECTORS, TIMEOUTS } from "../helpers/constants";
import { waitForGameReady, waitForRoomLoaded, captureConsole } from "../helpers/game";

// The largest value one stored character can carry (see RoomPrefsUtil). Written out rather than
// imported, since what this is checking is what arrived over the wire rather than what the client
// bundle happens to believe.
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

        // Every field decoded to a whole number inside its range. A field that came through as
        // undefined or NaN is the wire format having gone out of step, which is the failure this
        // spec exists for.
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

        // The lighting is encoded ahead of the room's contents, so contents that came through at
        // all is the proof that the field was read back at exactly the width it was written. Every
        // room has a way in, so there is always at least one object to find.
        const ready = await authenticatedPage.evaluate(
            () => (window as any).__thingspool_automation.ready());
        expect(ready.room).toBe(true);
        expect(ready.objectCount).toBeGreaterThan(0);
    });

    test("drawing a lit room raises nothing", async ({ authenticatedPage }) => {
        // Every lit material samples the room's light field, and the fog is compiled into all of
        // them — so a mistake in either is a shader that fails to link, which surfaces as a console
        // error rather than as a wrong picture.
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
