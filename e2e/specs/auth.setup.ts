import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const AUTH_STATE_PATH = path.join(__dirname, "../.auth/guest.json");
const AUTH_STATE_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

// This setup runs once before all authenticated tests. It creates a guest user
// by visiting /mypage (which auto-creates a guest and sets the thingspool_token
// cookie), then saves the browser's storage state for reuse.
//
// To avoid burning through the staging server's rate limit (3 guests per
// User-Agent per hour), it reuses a previously saved auth state if it's
// less than 30 minutes old.
setup("authenticate as guest", async ({ page }) => {
    const authDir = path.dirname(AUTH_STATE_PATH);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    // Reuse existing auth state if it's recent enough
    if (fs.existsSync(AUTH_STATE_PATH)) {
        const age = Date.now() - fs.statSync(AUTH_STATE_PATH).mtimeMs;
        if (age < AUTH_STATE_MAX_AGE_MS) {
            // eslint-disable-next-line no-console
            console.log(`Reusing cached auth state (age: ${Math.round(age / 1000)}s)`);
            return;
        }
    }

    // Create a new guest session
    const response = await page.goto("/mypage", { waitUntil: "networkidle" });
    const status = response?.status() ?? 0;
    const body = await page.textContent("body");

    if (status === 401 || body?.includes("Failed to identify the user")) {
        throw new Error(
            "Guest creation was rate-limited by the staging server. " +
            "The server allows 3 guest accounts per User-Agent per hour. " +
            "In CI, this resets on each staging deploy. Locally, wait up to 1 hour."
        );
    }

    // Verify the authenticated game page rendered
    await expect(page.locator("#gameCanvasRoot")).toBeAttached({ timeout: 30_000 });

    // Save cookies for reuse by all authenticated test projects
    await page.context().storageState({ path: AUTH_STATE_PATH });
});
