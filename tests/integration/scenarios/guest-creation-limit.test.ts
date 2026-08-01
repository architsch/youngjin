/**
 * Integration tests: Guest account creation limits
 *
 * Guest creation is capped along two dimensions, both scoped to the requesting client:
 * - a looser per-IP cap, so one shared network (office, campus) is not treated as one visitor
 * - a tighter per-client cap, keyed on IP *and* User-Agent together
 *
 * The per-client cap must never be keyed on the User-Agent alone: that string is shared by
 * every browser of a given version worldwide, so a UA-only key turns the cap into a global
 * throttle in which a handful of visitors lock out everyone else running the same browser.
 *
 * The limiter keeps its counters in module-level state for the process lifetime, so each
 * test below uses its own IP/User-Agent values rather than resetting between tests.
 *
 * These run with MODE unset (i.e. not "dev"), so the production caps are in force. Were
 * that to change, the "blocked once the cap is reached" assertions would fail rather than
 * pass vacuously.
 */
import { describe, it, expect } from "vitest";
import GuestCreationLimitUtil from "../../../src/server/user/util/guestCreationLimitUtil";

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

            // Four distinct browsers behind one address. The per-client cap would permit
            // 4 x 3 = 12, but the per-IP cap is the binding constraint.
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

            // Unrelated visitors on the same browser version must be unaffected. Keyed on
            // the User-Agent alone, every one of these would be refused.
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

            // Exhaust one browser's per-client budget, then keep hammering. The rejected
            // attempts must not draw down the IP budget the other browsers still need.
            countAllowed(MAX_PER_CLIENT, ip, "ua-heavy");
            countAllowed(30, ip, "ua-heavy");

            // MAX_PER_IP - MAX_PER_CLIENT should remain for other browsers on this IP.
            const remaining = ["ua-x", "ua-y", "ua-z"]
                .reduce((sum, ua) => sum + countAllowed(MAX_PER_CLIENT, ip, ua), 0);

            expect(remaining).toBe(MAX_PER_IP - MAX_PER_CLIENT);
        });
    });
});
