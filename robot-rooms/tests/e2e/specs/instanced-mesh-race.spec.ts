import { test, expect } from "../fixtures/auth.fixture";

// Regression: composed objects spawning in the same frame must share one instanced mesh load (a
// duplicate creation makes parts invisible). Listeners attach before navigation, since the failure
// happens during the initial load.
test.describe("Instanced mesh concurrent loading", () => {
    test("same-frame spawns do not duplicate instanced-mesh loads", async ({ page }) => {
        const errors: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "error")
                errors.push(msg.text());
        });
        page.on("pageerror", (err) => errors.push(err.message));

        await page.goto("/", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(8000); // Give the room + objects time to spawn and load meshes.

        const raceErrors = errors.filter(
            (e) => e.includes("InstanceId pool already exists")
                || e.includes("Failed to load an instanced mesh")
        );
        expect(raceErrors, `Instanced-mesh race errors:\n${raceErrors.join("\n")}`).toHaveLength(0);
    });
});
