import { test, expect } from "../fixtures/auth.fixture";
import { SELECTORS } from "../helpers/constants";

// The Three.js canvas is created after the full game initialization sequence:
// page load → bundle exec → socket connect → room data received → renderer init.
// This takes significantly longer than a simple page load, so we use a generous timeout.
const GAME_INIT_TIMEOUT = 45_000;

test.describe("Three.js Canvas", () => {
    test("canvas element is created inside gameCanvasRoot", async ({ authenticatedPage }) => {
        await expect(authenticatedPage.locator(SELECTORS.THREE_CANVAS))
            .toBeVisible({ timeout: GAME_INIT_TIMEOUT });
    });

    test("canvas has non-zero dimensions", async ({ authenticatedPage }) => {
        await authenticatedPage.waitForSelector(SELECTORS.THREE_CANVAS, {
            timeout: GAME_INIT_TIMEOUT,
        });

        const dimensions = await authenticatedPage.evaluate((selector: string) => {
            const canvas = document.querySelector(selector) as HTMLCanvasElement;
            return canvas ? { width: canvas.width, height: canvas.height } : null;
        }, SELECTORS.THREE_CANVAS);

        expect(dimensions).not.toBeNull();
        expect(dimensions!.width).toBeGreaterThan(0);
        expect(dimensions!.height).toBeGreaterThan(0);
    });

    test("canvas accepts mouse input without errors", async ({ authenticatedPage }) => {
        await authenticatedPage.waitForSelector(SELECTORS.THREE_CANVAS, {
            timeout: GAME_INIT_TIMEOUT,
        });

        const errors: string[] = [];
        authenticatedPage.on("console", (msg) => {
            if (msg.type() === "error") errors.push(msg.text());
        });

        const canvas = authenticatedPage.locator(SELECTORS.THREE_CANVAS);
        const box = await canvas.boundingBox();
        expect(box).not.toBeNull();

        const centerX = box!.x + box!.width / 2;
        const centerY = box!.y + box!.height / 2;

        await authenticatedPage.mouse.move(centerX, centerY);
        await authenticatedPage.mouse.click(centerX, centerY);
        await authenticatedPage.mouse.move(centerX + 50, centerY + 50);

        // Brief pause to let any error handlers fire
        await authenticatedPage.waitForTimeout(1000);

        const criticalErrors = errors.filter(
            (e) => !e.includes("favicon") && !e.includes("404")
        );
        expect(criticalErrors).toHaveLength(0);
    });
});
