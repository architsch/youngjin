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
        // Which of the two forms appears depends on the deployment under test: a non-public one
        // (staging, this suite's usual target) closes itself to crawlers wholesale, which covers
        // the socket endpoint along with everything else, while the live site singles it out.
        expect(text).toMatch(/^Disallow: (\/|\/socket\.io\/)$/m);
    });
});
