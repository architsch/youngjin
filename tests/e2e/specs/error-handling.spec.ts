/** E2E: rate-limit headers, status codes for invalid routes, and auth rejection on API endpoints. */
import { test, expect } from "@playwright/test";

test.describe("Error Handling", () => {
    test("API endpoints reject unauthenticated requests", async ({ request }) => {
        // Attempt to access a protected API endpoint without cookies
        const response = await request.post("/api/room/change_room_texture", {
            data: { texturePackPath: "default" },
            headers: { "Cookie": "" },
        });

        // Should be rejected with an auth error — 500 is not acceptable
        expect([401, 403]).toContain(response.status());
    });

    test("unknown multi-segment routes return 404", async ({ request }) => {
        const response = await request.get("/this/page/does/not/exist");
        expect(response.status()).toBe(404);
    });

    test("single-segment paths that are not room addresses return 404", async ({ request }) => {
        // Non-room-shaped paths must 404 before identification (otherwise each scanner probe costs a
        // guest account). Avoids static-file extensions, which local dev serves from public/.
        for (const path of ["/wp-login.php", "/.env", "/admin", "/short", "/this-is-not-a-room-id"])
        {
            const response = await request.get(path);
            expect(response.status(), `Expected 404 for ${path}`).toBe(404);
        }
    });

    test("rate limit headers are present on page responses", async ({ request }) => {
        const response = await request.get("/");
        expect(response.status()).toBe(200);
        const headers = response.headers();
        // Check for standard rate limit headers (express-rate-limit sets these)
        const hasRateLimit = !!(
            headers["ratelimit-limit"] ||
            headers["x-ratelimit-limit"] ||
            headers["retry-after"]
        );
        expect(hasRateLimit, "Expected rate limit headers (ratelimit-limit, x-ratelimit-limit, or retry-after)").toBe(true);
    });

    test("debug-connection endpoint provides connection diagnostics", async ({ request }) => {
        const response = await request.get("/debug-connection");
        expect(response.status()).toBe(200);

        const json = await response.json();
        expect(json.status).toBe("ok");
        expect(json.headers).toBeDefined();
        expect(json.timestamp).toBeTruthy();
        expect(typeof json.secure).toBe("boolean");
        expect(json.protocol).toBeTruthy();
    });
});
