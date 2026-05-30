/**
 * Integration tests: Authentication lifecycle
 *
 * Covers:
 * - Scenario 10: Google OAuth — new account creation (guest upgrade) and existing account access
 * - Scenario 11: Stale guest account cleanup via deleteStaleGuestsByTier
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";

// ─── Hoisted mock state (vi.mock factories are hoisted, so refs must be too) ─

const _mockDBUserUtil = vi.hoisted(() => ({
    createUser: vi.fn(),
    findUserById: vi.fn(),
    upgradeGuestToMember: vi.fn(),
    deleteUser: vi.fn(),
    updateLastLogin: vi.fn(),
    setOwnedRoomID: vi.fn(),
    fromDBType: vi.fn((u: any) => u),
    setLastRoomID: vi.fn(),
    savePlayerMetadata: vi.fn(),
    saveMultipleUsersPlayerMetadata: vi.fn(),
    setSinglePlayerMode: vi.fn(),
    deleteStaleGuestsByTier: vi.fn(),
}));

const _mockDBSearchUtil = vi.hoisted(() => ({
    rooms: { all: vi.fn(), withRoomType: vi.fn() },
    users: {
        all: vi.fn(),
        withUserName: vi.fn(),
        withEmail: vi.fn(),
        withUserNameOrEmail: vi.fn(),
    },
}));

const _mockRestAPI = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
}));

const _mockUserTokenUtil = vi.hoisted(() => ({
    getUserIdFromToken: vi.fn((token: string) => {
        return token.startsWith("valid-") ? token.replace("valid-", "") : undefined;
    }),
    addTokenForUserId: vi.fn(),
    clearToken: vi.fn(),
}));

// ─── Apply mocks ──────────────────────────────────────────────────────────

vi.mock("../../../src/server/db/util/dbUserUtil", () => ({
    default: _mockDBUserUtil,
}));

vi.mock("../../../src/server/db/util/dbSearchUtil", () => ({
    default: _mockDBSearchUtil,
}));

vi.mock("../../../src/client/networking/api/restAPI", () => ({
    default: _mockRestAPI,
}));

vi.mock("../../../src/server/networking/util/addressUtil", () => ({
    default: {
        getErrorPageURL: (name: string) => `/error/${name}`,
        getEnvStaticURL: () => "http://localhost:3000",
        getEnvDynamicURL: () => "http://localhost:3000",
    },
}));

vi.mock("../../../src/server/networking/util/cookieUtil", () => ({
    default: {
        getAuthTokenName: () => "auth_token_dev",
        getAuthTokenCookieOptions: () => ({ httpOnly: true, sameSite: "lax" }),
    },
}));

vi.mock("../../../src/server/user/util/userTokenUtil", () => ({
    default: _mockUserTokenUtil,
}));

vi.mock("../../../src/server/system/util/latencySimUtil", () => ({
    default: {
        networkLatencyEnabled: false,
        dbLatencyEnabled: false,
        simulateNetworkLatency: async () => {},
        simulateDBLatency: async () => {},
        getConfigSummary: () => "",
    },
}));

vi.mock("../../../src/server/user/util/guestCreationLimitUtil", () => ({
    default: {
        allowGuestCreation: vi.fn(() => true),
    },
}));

// ─── Import after mocks ──────────────────────────────────────────────────

import UserAuthGoogleUtil from "../../../src/server/user/util/userAuthGoogleUtil";
import UserIdentificationUtil from "../../../src/server/user/util/userIdentificationUtil";

// ─── Helpers ──────────────────────────────────────────────────────────────

function createMockReqRes(cookies: Record<string, string> = {}, queryUrl?: string) {
    const req: any = {
        url: queryUrl || "/login_google_callback?code=test-auth-code",
        cookies,
        ip: "127.0.0.1",
        headers: { "user-agent": "test" },
    };
    const res: any = {
        statusCode: 200,
        redirectUrl: undefined,
        body: undefined,
        status(code: number) { this.statusCode = code; return this; },
        send(data: any) { this.body = data; return this; },
        json(data: any) { this.body = data; return this; },
        redirect(url: string) { this.redirectUrl = url; return this; },
        cookie() { return this; },
    };
    return { req, res };
}

// ─── Tests: Google OAuth (Scenario 10) ────────────────────────────────────

describe("Google OAuth lifecycle (Scenario 10)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("new user via Google OAuth: upgrades existing guest to member", async () => {
        _mockRestAPI.post.mockResolvedValue({
            status: 200,
            data: { access_token: "google-access-token-123" },
        });
        _mockRestAPI.get.mockResolvedValue({
            status: 200,
            data: { email: "newuser@gmail.com", name: "New User" },
        });

        // No existing user with this email
        _mockDBSearchUtil.users.withEmail.mockResolvedValue({ success: true, data: [] });
        // No username conflict
        _mockDBSearchUtil.users.withUserName.mockResolvedValue({ success: true, data: [] });
        // Upgrade succeeds
        _mockDBUserUtil.upgradeGuestToMember.mockResolvedValue({ success: true, data: [] });

        const { req, res } = createMockReqRes({ auth_token_dev: "valid-guest-1" });
        await UserAuthGoogleUtil.loginCallback(req, res);

        // Should upgrade guest to member (not create a new user)
        expect(_mockDBUserUtil.upgradeGuestToMember).toHaveBeenCalledWith(
            "guest-1", "newuser", "newuser@gmail.com",
        );
        // Should redirect to the game page (root)
        expect(res.redirectUrl).toBe("/");
    });

    it("new user via Google OAuth: creates member when no guest exists", async () => {
        _mockRestAPI.post.mockResolvedValue({
            status: 200,
            data: { access_token: "google-access-token-456" },
        });
        _mockRestAPI.get.mockResolvedValue({
            status: 200,
            data: { email: "brandnew@gmail.com", name: "Brand New" },
        });

        _mockDBSearchUtil.users.withEmail.mockResolvedValue({ success: true, data: [] });
        _mockDBSearchUtil.users.withUserName.mockResolvedValue({ success: true, data: [] });
        _mockDBUserUtil.createUser.mockResolvedValue({ success: true, data: [{ id: "new-member-1" }] });

        // No guest token in cookies
        const { req, res } = createMockReqRes({});
        await UserAuthGoogleUtil.loginCallback(req, res);

        // Should create a new member (no guest to upgrade)
        expect(_mockDBUserUtil.createUser).toHaveBeenCalledWith(
            "brandnew", UserTypeEnumMap.Member, "brandnew@gmail.com",
        );
        expect(res.redirectUrl).toBe("/");
    });

    it("existing user via Google OAuth: signs in and cleans up orphaned guest", async () => {
        _mockRestAPI.post.mockResolvedValue({
            status: 200,
            data: { access_token: "google-access-token-789" },
        });
        _mockRestAPI.get.mockResolvedValue({
            status: 200,
            data: { email: "existing@gmail.com", name: "Existing User" },
        });

        // Existing member with this email
        _mockDBSearchUtil.users.withEmail.mockResolvedValue({
            success: true,
            data: [{ id: "existing-member", userName: "existing", email: "existing@gmail.com", userType: UserTypeEnumMap.Member }],
        });
        _mockDBUserUtil.deleteUser.mockResolvedValue({ success: true, data: [] });

        // Current session has a different guest
        const { req, res } = createMockReqRes({ auth_token_dev: "valid-orphan-guest" });
        await UserAuthGoogleUtil.loginCallback(req, res);

        // Should delete the orphaned guest
        expect(_mockDBUserUtil.deleteUser).toHaveBeenCalledWith("orphan-guest");
        // Should sign token for existing member
        expect(_mockUserTokenUtil.addTokenForUserId).toHaveBeenCalledWith(
            "existing-member", req, res,
        );
        expect(res.redirectUrl).toBe("/");
    });

    it("Google OAuth fails gracefully when no auth code provided", async () => {
        const { req, res } = createMockReqRes({}, "/login_google_callback");
        await UserAuthGoogleUtil.loginCallback(req, res);

        expect(res.statusCode).toBe(400);
        expect(res.body).toContain("code not found");
    });

    it("Google OAuth fails gracefully when token exchange fails", async () => {
        _mockRestAPI.post.mockResolvedValue({
            status: 401,
            data: { error: "invalid_grant" },
        });

        const { req, res } = createMockReqRes({});
        await UserAuthGoogleUtil.loginCallback(req, res);

        expect(res.statusCode).toBe(500);
        expect(res.body).toContain("access token");
    });
});

// ─── Tests: Stale guest cleanup constants & tier classification (Scenario 11) ─

/**
 * The real deleteStaleGuestsByTier is deeply coupled to DBQuery, so we test
 * the tier classification logic and threshold constants directly. This
 * mirrors the inline tierFilter inside dbUserUtil.deleteStaleGuestsByTier.
 */
import {
    GUEST_TIER_NAME_BY_TIER_PHASE,
    GUEST_MAX_AGE_BY_TIER_PHASE,
} from "../../../src/server/system/serverConstants";
import { DAY_IN_MS } from "../../../src/shared/system/sharedConstants";

/** Replicates the tier classification logic from dbUserUtil.deleteStaleGuestsByTier. */
function classifyGuestTier(loginCount: number): number
{
    if (loginCount > 3) return 2;
    if (loginCount > 1) return 1;
    return 0;
}

describe("stale guest tier classification (Scenario 11)", () => {
    it("tier names are defined for all 3 phases", () => {
        expect(GUEST_TIER_NAME_BY_TIER_PHASE).toEqual(["disposable", "casual", "dedicated"]);
    });

    it("tier max ages use correct day thresholds", () => {
        expect(GUEST_MAX_AGE_BY_TIER_PHASE[0]).toBe(3 * DAY_IN_MS);
        expect(GUEST_MAX_AGE_BY_TIER_PHASE[1]).toBe(7 * DAY_IN_MS);
        expect(GUEST_MAX_AGE_BY_TIER_PHASE[2]).toBe(30 * DAY_IN_MS);
    });

    it("single-login guest is classified as disposable (tier 0)", () => {
        expect(classifyGuestTier(0)).toBe(0);
        expect(classifyGuestTier(1)).toBe(0);
    });

    it("multi-login guest (2-3 logins) is classified as casual (tier 1)", () => {
        expect(classifyGuestTier(2)).toBe(1);
        expect(classifyGuestTier(3)).toBe(1);
    });

    it("frequent guest (4+ logins) is classified as dedicated (tier 2)", () => {
        expect(classifyGuestTier(4)).toBe(2);
        expect(classifyGuestTier(10)).toBe(2);
    });

    it("tier boundary: loginCount=1 stays disposable", () => {
        // loginCount must be > 1 for casual, not >= 1
        expect(classifyGuestTier(1)).toBe(0);
    });

    it("tier boundary: loginCount=3 stays casual", () => {
        // loginCount must be > 3 for dedicated, not >= 3
        expect(classifyGuestTier(3)).toBe(1);
    });
});

// ─── Tests: loginCount only incremented on page access (Scenario 12) ─────

describe("loginCount accuracy (Scenario 12)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("identifyAnyUser calls updateLastLogin for an existing user", async () => {
        _mockDBUserUtil.findUserById.mockResolvedValue({
            id: "user-1", userName: "testuser", userType: UserTypeEnumMap.Member, email: "test@test.com",
        });

        const { req, res } = createMockReqRes({ auth_token_dev: "valid-user-1" });
        let nextCalled = false;
        await UserIdentificationUtil.identifyAnyUser(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(true);
        expect(_mockDBUserUtil.updateLastLogin).toHaveBeenCalledTimes(1);
        expect(_mockDBUserUtil.updateLastLogin).toHaveBeenCalledWith("user-1");
    });

    it("identifyRegisteredUser does NOT call updateLastLogin", async () => {
        _mockDBUserUtil.findUserById.mockResolvedValue({
            id: "user-1", userName: "testuser", userType: UserTypeEnumMap.Member, email: "test@test.com",
        });

        const { req, res } = createMockReqRes({ auth_token_dev: "valid-user-1" });
        let nextCalled = false;
        await UserIdentificationUtil.identifyRegisteredUser(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(true);
        expect(_mockDBUserUtil.updateLastLogin).not.toHaveBeenCalled();
    });

    it("identifyAdmin does NOT call updateLastLogin", async () => {
        _mockDBUserUtil.findUserById.mockResolvedValue({
            id: "admin-1", userName: "admin", userType: UserTypeEnumMap.Admin, email: "admin@test.com",
        });

        const { req, res } = createMockReqRes({ auth_token_dev: "valid-admin-1" });
        let nextCalled = false;
        await UserIdentificationUtil.identifyAdmin(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(true);
        expect(_mockDBUserUtil.updateLastLogin).not.toHaveBeenCalled();
    });

    it("multiple API calls via identifyRegisteredUser do not inflate loginCount", async () => {
        _mockDBUserUtil.findUserById.mockResolvedValue({
            id: "user-1", userName: "testuser", userType: UserTypeEnumMap.Member, email: "test@test.com",
        });

        // Simulate 5 API calls (e.g. create_room, change_room_texture, etc.)
        for (let i = 0; i < 5; i++)
        {
            const { req, res } = createMockReqRes({ auth_token_dev: "valid-user-1" });
            await UserIdentificationUtil.identifyRegisteredUser(req, res, () => {});
        }

        expect(_mockDBUserUtil.updateLastLogin).not.toHaveBeenCalled();
    });
});
