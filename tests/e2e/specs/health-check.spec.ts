import { test, expect } from "@playwright/test";

test.describe("Health Check", () => {
    test("GET / returns 200", async ({ request }) => {
        const response = await request.get("/");
        expect(response.status()).toBe(200);
    });

    test("GET /debug-connection returns valid JSON", async ({ request }) => {
        const response = await request.get("/debug-connection");
        expect(response.status()).toBe(200);
        const json = await response.json();
        expect(json.status).toBe("ok");
        expect(json.timestamp).toBeTruthy();
    });

    test("GET /robots.txt keeps crawlers off the socket endpoint", async ({ request }) => {
        const response = await request.get("/robots.txt");
        expect(response.status()).toBe(200);
        const text = await response.text();
        // Non-public deployments disallow everything; the live site disallows only the socket endpoint.
        expect(text).toMatch(/^Disallow: (\/|\/socket\.io\/)$/m);
    });
});
