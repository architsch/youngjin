/**
 * Integration tests: guest creation limits — a looser per-IP cap (shared networks) and a tighter
 * per-client cap keyed on IP + User-Agent (never UA alone, which would throttle a browser version
 * globally). Limiter state is process-wide, so each test uses its own IP/UA. MODE is unset, so the
 * production caps apply.
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
});
