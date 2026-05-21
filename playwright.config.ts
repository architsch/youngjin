import { defineConfig, devices } from "@playwright/test";
import path from "path";

const BASE_URL = process.env.E2E_BASE_URL || "https://staging.thingspool.net";
const AUTH_STATE_PATH = path.join(__dirname, "tests/e2e/.auth/guest.json");

// When the target is a local dev server, Playwright boots it automatically.
// Remote targets (staging / live) are expected to already be running.
const isLocalServer = /\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(BASE_URL);

export default defineConfig({
    testDir: "./tests/e2e/specs",
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
    // For local runs (npm run test:e2e:local) boot the dev stack automatically and
    // wait until it answers on /health (a side-effect-free 200 — unlike "/", which
    // would create a guest). If a server is already listening on the port, reuse it
    // as-is and leave it running. For remote targets nothing is started locally.
    //
    // The launcher (rather than `npm run devnossg` directly) frees stale Firebase-
    // emulator ports on startup and tears the whole stack down on teardown;
    // `gracefulShutdown` sends it SIGTERM instead of the default SIGKILL so its
    // cleanup handler can run. The npm script to boot is passed as the argument.
    webServer: isLocalServer ? {
        command: "node dev/scripts/e2eDevServer.js devnossg",
        url: `${BASE_URL.replace(/\/$/, "")}/health`,
        reuseExistingServer: true,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
        gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    } : undefined,
    use: {
        baseURL: BASE_URL,
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
