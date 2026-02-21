import { defineConfig, devices } from "@playwright/test";
import path from "path";

const STAGING_URL = process.env.E2E_BASE_URL || "https://staging.thingspool.net";
const AUTH_STATE_PATH = path.join(__dirname, "e2e/.auth/guest.json");

export default defineConfig({
    testDir: "./e2e/specs",
    timeout: 60_000,
    expect: {
        timeout: 10_000,
    },
    fullyParallel: false,
    workers: 1,
    retries: 1,
    reporter: [
        ["list"],
        ["html", { open: "never" }],
    ],
    use: {
        baseURL: STAGING_URL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
        navigationTimeout: 30_000,
        ignoreHTTPSErrors: true,
    },
    projects: [
        // Health check tests run without authentication
        {
            name: "health-check",
            testMatch: /health-check\.spec\.ts/,
            use: { ...devices["Desktop Chrome"] },
        },
        // Auth setup creates a guest session and saves cookies
        {
            name: "setup",
            testMatch: /auth\.setup\.ts/,
        },
        // Authenticated tests depend on the setup project
        {
            name: "chromium",
            testIgnore: /health-check\.spec\.ts/,
            use: {
                ...devices["Desktop Chrome"],
                storageState: AUTH_STATE_PATH,
                launchOptions: {
                    args: [
                        "--use-gl=angle",
                        "--use-angle=swiftshader",
                        "--enable-webgl",
                    ],
                },
            },
            dependencies: ["setup"],
        },
    ],
});
