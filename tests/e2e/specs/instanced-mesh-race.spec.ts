import { test, expect } from "../fixtures/auth.fixture";

// Regression test: multiple composed objects spawning in the same frame (e.g. the user's player
// and the tutorial's NPC player) request the same instanced meshes concurrently. Those requests
// must share a single load — a duplicate creation clobbers the mesh registry and its instanceId
// pool, leaving every part on the affected mesh invisible.
//
// The console/page-error listeners attach before navigation, because the failure fires during the
// initial room load (listeners attached after the fact miss it).
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
