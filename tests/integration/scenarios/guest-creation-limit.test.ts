/**
 * Integration tests: guest creation limits — a looser per-IP cap (shared networks) and a tighter
 * per-client cap keyed on IP + User-Agent (never UA alone, which would throttle a browser version
 * globally). Limiter state is process-wide, so each test uses its own IP/UA. MODE is unset, so the
 * production caps apply. Also covers which User-Agents are treated as bots and never given a guest.
 */
import { describe, it, expect } from "vitest";
import GuestCreationLimitUtil from "../../../src/server/user/util/guestCreationLimitUtil";
import BotDetectionUtil from "../../../src/server/networking/util/botDetectionUtil";

const MAX_PER_IP = 10;
const MAX_PER_CLIENT = 3;

// A real-world User-Agent, shared verbatim by every visitor on this browser version.
const SHARED_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

function countAllowed(attempts: number, ip: string, userAgent: string): number
{
    let allowed = 0;
    for (let i = 0; i < attempts; i++)
    {
        if (GuestCreationLimitUtil.allowGuestCreation(ip, userAgent))
            allowed++;
    }
    return allowed;
}

describe("Guest creation limits", () =>
{
    describe("per-client cap", () =>
    {
        it("allows up to the cap for one IP + User-Agent, then blocks", () =>
        {
            const ip = "203.0.113.1";

            expect(countAllowed(MAX_PER_CLIENT, ip, SHARED_UA)).toBe(MAX_PER_CLIENT);
            expect(GuestCreationLimitUtil.allowGuestCreation(ip, SHARED_UA)).toBe(false);
        });

        it("gives each User-Agent on one IP its own budget, up to the IP cap", () =>
        {
            const ip = "203.0.113.2";

            // Four browsers on one IP: the per-IP cap binds before the per-client caps.
            const allowed = ["ua-a", "ua-b", "ua-c", "ua-d"]
                .reduce((sum, ua) => sum + countAllowed(MAX_PER_CLIENT, ip, ua), 0);

            expect(allowed).toBe(MAX_PER_IP);
        });
    });

    describe("per-IP scoping (regression: cap must not be keyed on User-Agent alone)", () =>
    {
        it("does not let one visitor exhaust the cap for others sharing a User-Agent", () =>
        {
            // Exhaust one visitor's per-client budget, plus extra rejected attempts.
            const heavyIP = "203.0.113.10";
            countAllowed(MAX_PER_CLIENT + 20, heavyIP, SHARED_UA);
            expect(GuestCreationLimitUtil.allowGuestCreation(heavyIP, SHARED_UA)).toBe(false);

            // Other visitors with the same User-Agent are unaffected.
            for (let i = 0; i < 25; i++)
            {
                const otherIP = `198.51.100.${i}`;
                expect(GuestCreationLimitUtil.allowGuestCreation(otherIP, SHARED_UA)).toBe(true);
            }
        });
    });

    describe("budget accounting", () =>
    {
        it("does not spend IP budget on attempts the per-client cap rejects", () =>
        {
            const ip = "203.0.113.20";

            // Rejected attempts from an exhausted client must not consume the IP budget.
            countAllowed(MAX_PER_CLIENT, ip, "ua-heavy");
            countAllowed(30, ip, "ua-heavy");

            // MAX_PER_IP - MAX_PER_CLIENT should remain for other browsers on this IP.
            const remaining = ["ua-x", "ua-y", "ua-z"]
                .reduce((sum, ua) => sum + countAllowed(MAX_PER_CLIENT, ip, ua), 0);

            expect(remaining).toBe(MAX_PER_IP - MAX_PER_CLIENT);
        });
    });

    // Each guest minted for a fetcher that keeps no cookies is counted as an acquisition arrival.
    describe("bot detection (no guest at all)", () =>
    {
        it.each([
            ["self-declared crawler", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
            ["Discord preview", "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"],
            ["Facebook preview", "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"],
            ["Meta crawler", "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)"],
            ["WhatsApp preview", "WhatsApp/2.23.20.0 A"],
            ["Bluesky preview", "Mozilla/5.0 (compatible; Bluesky Cardyb/1.1; +mailto:support@bsky.app)"],
            ["Mastodon preview", "http.rb/5.1.1 (Mastodon/4.2.10; +https://mastodon.social/)"],
            ["Iframely preview", "Iframely/1.3.1 (+https://iframely.com/docs/about)"],
            ["Google inspection", "Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)"],
            ["curl", "curl/8.7.1"],
            ["Wget", "Wget/1.21.4"],
            ["python-requests", "python-requests/2.31.0"],
            ["Go client", "Go-http-client/2.0"],
            ["self-declared scanner", "odin-scanner/1.0"],
            ["scanner that says so in prose", "Hello from Palo Alto Networks, find out more about our scans in " +
                "https://docs-cortex.paloaltonetworks.com/r/1/Cortex-Xpanse/Scanning-activity"],
            ["aiohttp client", "Python/3.12 aiohttp/3.9.5"],
            ["fasthttp client", "fasthttp"],
            ["missing User-Agent", undefined],
            ["empty User-Agent", ""],
        ])("treats a %s as a bot", (_label, userAgent) =>
        {
            expect(BotDetectionUtil.isBot(userAgent)).toBe(true);
        });

        it.each([
            ["desktop Chrome", SHARED_UA],
            ["iPhone Safari", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 " +
                "(KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"],
            ["Facebook in-app browser", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 " +
                "(KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/500.0.0.0.0;FBBV/700000000]"],
            ["Instagram in-app browser", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 Instagram 400.0.0.0.0 Android"],
            ["headless Chromium (E2E and playtests)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
                "AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36"],
        ])("gives a %s an account", (_label, userAgent) =>
        {
            expect(BotDetectionUtil.isBot(userAgent)).toBe(false);
        });
    });
});
