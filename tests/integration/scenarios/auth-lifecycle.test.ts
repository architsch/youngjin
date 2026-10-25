/**
 * Integration tests: authentication lifecycle — signing in through Google, GitHub or Discord (guest upgrade, existing
 * account, verified emails only, no room of one's own, back to the room it started from), stale guest cleanup
 * (deleteStaleGuestsByTier), and loginCount (only distinct page-level logins count).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";

// ─── Hoisted mock state (vi.mock factories are hoisted, so refs must be too) ─

const _mockDBUserUtil = vi.hoisted(() => ({
    createUser: vi.fn(),
    findUserById: vi.fn(),
    lookUpUserById: vi.fn(),
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
        getOAuthStateCookieName: () => "oauth_state_dev",
        getOAuthReturnRoomCookieName: () => "oauth_return_room_dev",
        getOAuthStateCookieOptions: () => ({ httpOnly: true, sameSite: "lax" }),
        getTutorialFinishedCookieName: () => "tutorial_finished_dev",
        getTutorialFinishedCookieOptions: () => ({ httpOnly: true, sameSite: "lax" }),
        toClearOptions: ({ maxAge, expires, ...rest }: any) => rest,
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

import UserSignInUtil from "../../../src/server/user/util/userSignInUtil";
import GoogleSignInProvider from "../../../src/server/user/types/signInProvider/googleSignInProvider";
import GitHubSignInProvider from "../../../src/server/user/types/signInProvider/gitHubSignInProvider";
import DiscordSignInProvider from "../../../src/server/user/types/signInProvider/discordSignInProvider";
import SignInProviderMap from "../../../src/server/user/maps/signInProviderMap";
import SignInProviderNameMap from "../../../src/shared/user/maps/signInProviderNameMap";
import UserIdentificationUtil from "../../../src/server/user/util/userIdentificationUtil";

// ─── Helpers ──────────────────────────────────────────────────────────────

const OAUTH_STATE = "test-oauth-state";

// By default, the callback of a sign-in this browser started: the URL carries the state its cookie holds.
function createMockReqRes(cookies: Record<string, string> = {}, queryUrl?: string) {
    const url = queryUrl || `/login_google_callback?code=test-auth-code&state=${OAUTH_STATE}`;
    const req: any = {
        url,
        query: Object.fromEntries(new URL(url, "http://localhost").searchParams), // as Express parses it
        cookies: { oauth_state_dev: OAUTH_STATE, ...cookies },
        ip: "127.0.0.1",
        headers: { "user-agent": "test" },
    };
    const res: any = {
        statusCode: 200,
        redirectUrl: undefined,
        body: undefined,
        setCookies: {} as Record<string, string>,
        clearedCookies: [] as string[],
        status(code: number) { this.statusCode = code; return this; },
        send(data: any) { this.body = data; return this; },
        json(data: any) { this.body = data; return this; },
        redirect(url: string) { this.redirectUrl = url; return this; },
        cookie(name: string, value: string) { this.setCookies[name] = value; return this; },
        clearCookie(name: string) { this.clearedCookies.push(name); return this; },
    };
    return { req, res };
}

// ─── Tests: Google OAuth (Scenario 10) ────────────────────────────────────

// A room's id, as a sign-in started in that room carries it (see UserAPIClient.signIn).
const ROOM_ID = "AbCdEfGhIjKlMnOpQrSt";

describe("Google OAuth lifecycle (Scenario 10)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "google-client");
        vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "google-secret");
        // Default: the browser's token belongs to a guest (the only kind a sign-in may absorb).
        _mockDBUserUtil.findUserById.mockImplementation(async (userID: string) =>
            ({ id: userID, userName: userID, userType: UserTypeEnumMap.Guest }));
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

        // Signed in from a room: the sign-in started there keeps it.
        const { req, res } = createMockReqRes({ auth_token_dev: "valid-guest-1", oauth_return_room_dev: ROOM_ID });
        await UserSignInUtil.loginCallback(GoogleSignInProvider, req, res);

        // Should upgrade guest to member (not create a new user)
        expect(_mockDBUserUtil.upgradeGuestToMember).toHaveBeenCalledWith(
            "guest-1", "newuser", "newuser@gmail.com",
        );
        // No room of one's own: the new member's player arrives back in the room it signed in from.
        expect(_mockDBUserUtil.setOwnedRoomID).not.toHaveBeenCalled();
        expect(res.redirectUrl).toBe(`/${ROOM_ID}`);
        expect(res.clearedCookies).toContain("oauth_return_room_dev");
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

        // No guest token in cookies, and a sign-in started from no room (or a single-player one)
        const { req, res } = createMockReqRes({});
        await UserSignInUtil.loginCallback(GoogleSignInProvider, req, res);

        // Should create a new member (no guest to upgrade)
        expect(_mockDBUserUtil.createUser).toHaveBeenCalledWith(
            "brandnew", UserTypeEnumMap.Member, "brandnew@gmail.com",
        );
        expect(_mockUserTokenUtil.addTokenForUserId).toHaveBeenCalledWith("new-member-1", req, res);
        expect(_mockDBUserUtil.setOwnedRoomID).not.toHaveBeenCalled();
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

        // Current session has a different guest, signing in from a room
        const { req, res } = createMockReqRes({ auth_token_dev: "valid-orphan-guest", oauth_return_room_dev: ROOM_ID });
        await UserSignInUtil.loginCallback(GoogleSignInProvider, req, res);

        // Should delete the orphaned guest
        expect(_mockDBUserUtil.deleteUser).toHaveBeenCalledWith("orphan-guest");
        // Should sign token for existing member
        expect(_mockUserTokenUtil.addTokenForUserId).toHaveBeenCalledWith(
            "existing-member", req, res,
        );
        // The member's player arrives in the room the guest's was in, not in their last room.
        expect(res.redirectUrl).toBe(`/${ROOM_ID}`);
        // The sign-in's state is used up.
        expect(res.clearedCookies).toContain("oauth_state_dev");
    });

    it("signed-in member via Google OAuth: a new email leaves the member's own account untouched", async () => {
        _mockRestAPI.post.mockResolvedValue({
            status: 200,
            data: { access_token: "google-access-token-abc" },
        });
        _mockRestAPI.get.mockResolvedValue({
            status: 200,
            data: { email: "second@gmail.com", name: "Second Account" },
        });

        _mockDBSearchUtil.users.withEmail.mockResolvedValue({ success: true, data: [] });
        _mockDBSearchUtil.users.withUserName.mockResolvedValue({ success: true, data: [] });
        _mockDBUserUtil.createUser.mockResolvedValue({ success: true, data: [{ id: "second-member" }] });
        // The browser is still signed in as a member who never signed out.
        _mockDBUserUtil.findUserById.mockResolvedValue(
            { id: "member-1", userName: "member", userType: UserTypeEnumMap.Member });

        const { req, res } = createMockReqRes({ auth_token_dev: "valid-member-1" });
        await UserSignInUtil.loginCallback(GoogleSignInProvider, req, res);

        // The signed-in member is its own account; the browser's account isn't overwritten.
        expect(_mockDBUserUtil.upgradeGuestToMember).not.toHaveBeenCalled();
        expect(_mockDBUserUtil.createUser).toHaveBeenCalledWith(
            "second", UserTypeEnumMap.Member, "second@gmail.com",
        );
        expect(_mockUserTokenUtil.addTokenForUserId).toHaveBeenCalledWith("second-member", req, res);
    });

    it("signed-in member via Google OAuth: an existing email does not delete the account being left", async () => {
        _mockRestAPI.post.mockResolvedValue({
            status: 200,
            data: { access_token: "google-access-token-def" },
        });
        _mockRestAPI.get.mockResolvedValue({
            status: 200,
            data: { email: "existing@gmail.com", name: "Existing User" },
        });

        _mockDBSearchUtil.users.withEmail.mockResolvedValue({
            success: true,
            data: [{ id: "existing-member", userName: "existing", email: "existing@gmail.com", userType: UserTypeEnumMap.Member }],
        });
        // The browser is still signed in as a different member who never signed out.
        _mockDBUserUtil.findUserById.mockResolvedValue(
            { id: "member-1", userName: "member", userType: UserTypeEnumMap.Member });

        const { req, res } = createMockReqRes({ auth_token_dev: "valid-member-1" });
        await UserSignInUtil.loginCallback(GoogleSignInProvider, req, res);

        // Only a guest is an orphan of the sign-in; the member left behind keeps their account.
        expect(_mockDBUserUtil.deleteUser).not.toHaveBeenCalled();
        expect(_mockUserTokenUtil.addTokenForUserId).toHaveBeenCalledWith(
            "existing-member", req, res,
        );
    });

    it("Google OAuth fails gracefully when no auth code provided", async () => {
        const { req, res } = createMockReqRes({}, `/login_google_callback?state=${OAUTH_STATE}`);
        await UserSignInUtil.loginCallback(GoogleSignInProvider, req, res);

        expect(res.statusCode).toBe(400);
        expect(res.body).toContain("code not found");
    });

    it("Google OAuth refuses a code that is not a single string", async () => {
        const { req, res } = createMockReqRes();
        req.query.code = ["code-1", "code-2"]; // ?code=code-1&code=code-2, as Express parses it
        await UserSignInUtil.loginCallback(GoogleSignInProvider, req, res);

        expect(res.statusCode).toBe(400);
        expect(_mockRestAPI.post).not.toHaveBeenCalled();
    });

    it("Google OAuth passes the code on to Google as one parameter", async () => {
        _mockRestAPI.post.mockResolvedValue({ status: 401, data: { error: "invalid_grant" } });
        const { req, res } = createMockReqRes({},
            `/login_google_callback?code=${encodeURIComponent("abc&client_id=other")}&state=${OAUTH_STATE}`);
        await UserSignInUtil.loginCallback(GoogleSignInProvider, req, res);

        const tokenParams = new URL(_mockRestAPI.post.mock.calls[0][0]).searchParams;
        expect(tokenParams.get("code")).toBe("abc&client_id=other");
        expect(tokenParams.getAll("client_id")).toHaveLength(1);
    });

    it("Google sign-in keeps in a cookie the state it sends to Google", async () => {
        const { req, res } = createMockReqRes({}, "/login_google");
        await UserSignInUtil.login(GoogleSignInProvider, req, res);

        const state = res.setCookies["oauth_state_dev"];
        expect(state).toBeTruthy();
        expect(new URL(res.redirectUrl).searchParams.get("state")).toBe(state);
    });

    it("Google OAuth refuses a callback this browser did not start", async () => {
        const startedElsewhere = createMockReqRes();
        delete startedElsewhere.req.cookies.oauth_state_dev;
        const cases = [
            createMockReqRes({ oauth_state_dev: "another-sign-in" }),          // the state of another sign-in
            createMockReqRes({}, "/login_google_callback?code=test-auth-code"), // no state in the URL
            startedElsewhere,                                                   // no sign-in started in this browser
        ];
        for (const { req, res } of cases)
        {
            await UserSignInUtil.loginCallback(GoogleSignInProvider, req, res);
            expect(res.statusCode).toBe(400);
            expect(res.body).toContain("state");
        }
        // The code is never exchanged, so no account is signed into or changed.
        expect(_mockRestAPI.post).not.toHaveBeenCalled();
        expect(_mockUserTokenUtil.addTokenForUserId).not.toHaveBeenCalled();
        expect(_mockDBUserUtil.upgradeGuestToMember).not.toHaveBeenCalled();
    });

    it("Google OAuth fails gracefully when token exchange fails", async () => {
        _mockRestAPI.post.mockResolvedValue({
            status: 401,
            data: { error: "invalid_grant" },
        });

        const { req, res } = createMockReqRes({});
        await UserSignInUtil.loginCallback(GoogleSignInProvider, req, res);

        expect(res.statusCode).toBe(500);
        expect(res.body).toContain("access token");
    });
});

describe("signing in through GitHub and Discord, and where a sign-in returns to (Scenario 10)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
        for (const provider of ["GOOGLE", "GITHUB", "DISCORD"])
        {
            vi.stubEnv(`${provider}_OAUTH_CLIENT_ID`, `${provider.toLowerCase()}-client`);
            vi.stubEnv(`${provider}_OAUTH_CLIENT_SECRET`, `${provider.toLowerCase()}-secret`);
        }
        _mockDBUserUtil.findUserById.mockImplementation(async (userID: string) =>
            ({ id: userID, userName: userID, userType: UserTypeEnumMap.Guest }));
        _mockDBSearchUtil.users.withEmail.mockResolvedValue({ success: true, data: [] });
        _mockDBSearchUtil.users.withUserName.mockResolvedValue({ success: true, data: [] });
        _mockDBUserUtil.upgradeGuestToMember.mockResolvedValue({ success: true, data: [] });
    });

    // GitHub's answers: the code exchanged, then the user and their emails, by address.
    const answerAsGitHub = (login: string, emails: object[]) => {
        _mockRestAPI.post.mockResolvedValue({ status: 200, data: { access_token: "github-token" } });
        _mockRestAPI.get.mockImplementation(async (url: string) => url.endsWith("/user/emails")
            ? { status: 200, data: emails } : { status: 200, data: { login } });
    };
    const callback = async (provider: typeof GitHubSignInProvider, cookies: Record<string, string> = {}) => {
        const { req, res } = createMockReqRes({ auth_token_dev: "valid-guest-9", ...cookies },
            `/login_${provider.id}_callback?code=the-code&state=${OAUTH_STATE}`);
        await UserSignInUtil.loginCallback(provider, req, res);
        return res;
    };

    it("offers each provider the browser names, in its order, and only those set up", () => {
        expect(SignInProviderMap.getAll().map(provider => provider.id)).toEqual(Object.keys(SignInProviderNameMap));
        expect(SignInProviderMap.getOfferedIDs()).toEqual(["google", "github", "discord"]);

        vi.stubEnv("DISCORD_OAUTH_CLIENT_SECRET", "");
        expect(SignInProviderMap.getOfferedIDs()).toEqual(["google", "github"]);
    });

    it("signs a guest in through GitHub by its verified primary email, named by its login", async () => {
        answerAsGitHub("octo-cat", [{ email: "old@example.com", primary: false, verified: true },
            { email: "octo@example.com", primary: true, verified: true }]);

        await callback(GitHubSignInProvider);

        expect(_mockDBUserUtil.upgradeGuestToMember).toHaveBeenCalledWith("guest-9", "octo-cat", "octo@example.com");
        // The code goes to GitHub as JSON, and the answer is asked for as JSON.
        const [tokenURL, tokenRequest] = _mockRestAPI.post.mock.calls[0];
        expect(tokenURL).toBe("https://github.com/login/oauth/access_token");
        expect(tokenRequest.data).toMatchObject({ client_id: "github-client", code: "the-code" });
        expect(tokenRequest.headers.Accept).toBe("application/json");
    });

    it("refuses a GitHub account whose primary email isn't verified, and a code GitHub refused", async () => {
        answerAsGitHub("octo-cat", [{ email: "octo@example.com", primary: true, verified: false },
            { email: "other@example.com", primary: false, verified: true }]);
        expect((await callback(GitHubSignInProvider)).statusCode).toBe(403);

        // GitHub answers a refused code with 200 and an error in place of the token.
        _mockRestAPI.post.mockResolvedValue({ status: 200, data: { error: "bad_verification_code" } });
        const refused = await callback(GitHubSignInProvider);
        expect(refused.statusCode).toBe(500);
        expect(refused.body).toContain("access token");

        expect(_mockDBUserUtil.upgradeGuestToMember).not.toHaveBeenCalled();
        expect(_mockUserTokenUtil.addTokenForUserId).not.toHaveBeenCalled();
    });

    it("signs in through Discord with a verified email, the code going to Discord as a form", async () => {
        _mockRestAPI.post.mockResolvedValue({ status: 200, data: { access_token: "discord-token" } });
        _mockRestAPI.get.mockResolvedValue({ status: 200,
            data: { username: "gamer_1", email: "gamer@example.com", verified: true } });

        await callback(DiscordSignInProvider);

        expect(_mockDBUserUtil.upgradeGuestToMember).toHaveBeenCalledWith("guest-9", "gamer_1", "gamer@example.com");
        expect(_mockRestAPI.post.mock.calls[0][1].form)
            .toMatchObject({ grant_type: "authorization_code", code: "the-code", client_secret: "discord-secret" });
    });

    it("refuses a Discord account whose email isn't verified", async () => {
        _mockRestAPI.post.mockResolvedValue({ status: 200, data: { access_token: "discord-token" } });
        _mockRestAPI.get.mockResolvedValue({ status: 200,
            data: { username: "gamer_1", email: "gamer@example.com", verified: false } });

        expect((await callback(DiscordSignInProvider)).statusCode).toBe(403);
        expect(_mockDBUserUtil.upgradeGuestToMember).not.toHaveBeenCalled();
    });

    it("names a new member by the provider's name, kept to what names hold and passing for no guest", async () => {
        const named = async (login: string) => {
            _mockDBUserUtil.upgradeGuestToMember.mockClear();
            answerAsGitHub(login, [{ email: `${login.length}@example.com`, primary: true, verified: true }]);
            await callback(GitHubSignInProvider);
            return _mockDBUserUtil.upgradeGuestToMember.mock.calls[0][1];
        };

        expect(await named("a b+c!d")).toBe("abcd");
        expect(await named("Guest-1234")).toBe("member-Guest-1234");
        expect(await named("xy")).toBe("member-xy");
        expect(await named("a".repeat(40))).toHaveLength(24);
    });

    it("keeps the room a sign-in starts from, and returns there; nothing but a room's id is kept", async () => {
        const started = createMockReqRes({}, `/login_github?roomID=${ROOM_ID}`);
        await UserSignInUtil.login(GitHubSignInProvider, started.req, started.res);
        expect(started.res.setCookies["oauth_return_room_dev"]).toBe(ROOM_ID);
        expect(new URL(started.res.redirectUrl).host).toBe("github.com");

        const oddlyStarted = createMockReqRes({}, "/login_github?roomID=https://elsewhere.example");
        await UserSignInUtil.login(GitHubSignInProvider, oddlyStarted.req, oddlyStarted.res);
        expect(oddlyStarted.res.setCookies["oauth_return_room_dev"]).toBe("");

        answerAsGitHub("octo-cat", [{ email: "octo@example.com", primary: true, verified: true }]);
        expect((await callback(GitHubSignInProvider, { oauth_return_room_dev: ROOM_ID })).redirectUrl).toBe(`/${ROOM_ID}`);
        expect((await callback(GitHubSignInProvider, { oauth_return_room_dev: "//elsewhere.example" })).redirectUrl)
            .toBe("/");
    });

    it("starts no sign-in through a provider that isn't set up", async () => {
        vi.stubEnv("DISCORD_OAUTH_CLIENT_ID", "");
        const { req, res } = createMockReqRes({}, "/login_discord");
        await UserSignInUtil.login(DiscordSignInProvider, req, res);

        expect(res.statusCode).toBe(404);
        expect(res.redirectUrl).toBeUndefined();
    });
});

// ─── Tests: Stale guest cleanup constants & tier classification (Scenario 11) ─

/** deleteStaleGuestsByTier is coupled to DBQuery, so its tier logic and thresholds are tested directly. */
import {
    GUEST_TIER_NAME_BY_TIER_PHASE,
    GUEST_MAX_AGE_BY_TIER_PHASE,
    LOGIN_COUNT_MIN_GAP_MS,
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

    it("tier max ages are whole days that grow with each tier", () => {
        // Day counts are tuning; assert one whole-day cutoff per tier, longer for more returns.
        expect(GUEST_MAX_AGE_BY_TIER_PHASE).toHaveLength(GUEST_TIER_NAME_BY_TIER_PHASE.length);
        for (const maxAge of GUEST_MAX_AGE_BY_TIER_PHASE)
        {
            expect(maxAge).toBeGreaterThan(0);
            expect(maxAge % DAY_IN_MS).toBe(0);
        }
        expect(GUEST_MAX_AGE_BY_TIER_PHASE[1]).toBeGreaterThan(GUEST_MAX_AGE_BY_TIER_PHASE[0]);
        expect(GUEST_MAX_AGE_BY_TIER_PHASE[2]).toBeGreaterThan(GUEST_MAX_AGE_BY_TIER_PHASE[1]);
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

    it("identifyAnyUser calls updateLastLogin with the user's stored lastLoginAt", async () => {
        const storedLastLoginAt = Date.now() - 5000;
        _mockDBUserUtil.lookUpUserById.mockResolvedValue({ success: true, data: [{
            id: "user-1", userName: "testuser", userType: UserTypeEnumMap.Member, email: "test@test.com",
            lastLoginAt: storedLastLoginAt,
        }] });

        const { req, res } = createMockReqRes({ auth_token_dev: "valid-user-1" });
        let nextCalled = false;
        await UserIdentificationUtil.identifyAnyUser(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(true);
        expect(_mockDBUserUtil.updateLastLogin).toHaveBeenCalledTimes(1);
        expect(_mockDBUserUtil.updateLastLogin).toHaveBeenCalledWith("user-1", storedLastLoginAt);
    });

    it("identifyRegisteredUser does NOT call updateLastLogin", async () => {
        _mockDBUserUtil.lookUpUserById.mockResolvedValue({ success: true, data: [{
            id: "user-1", userName: "testuser", userType: UserTypeEnumMap.Member, email: "test@test.com",
        }] });

        const { req, res } = createMockReqRes({ auth_token_dev: "valid-user-1" });
        let nextCalled = false;
        await UserIdentificationUtil.identifyRegisteredUser(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(true);
        expect(_mockDBUserUtil.updateLastLogin).not.toHaveBeenCalled();
    });

    it("identifyAdmin does NOT call updateLastLogin", async () => {
        _mockDBUserUtil.lookUpUserById.mockResolvedValue({ success: true, data: [{
            id: "admin-1", userName: "admin", userType: UserTypeEnumMap.Admin, email: "admin@test.com",
        }] });

        const { req, res } = createMockReqRes({ auth_token_dev: "valid-admin-1" });
        let nextCalled = false;
        await UserIdentificationUtil.identifyAdmin(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(true);
        expect(_mockDBUserUtil.updateLastLogin).not.toHaveBeenCalled();
    });

    it("multiple API calls via identifyRegisteredUser do not inflate loginCount", async () => {
        _mockDBUserUtil.lookUpUserById.mockResolvedValue({ success: true, data: [{
            id: "user-1", userName: "testuser", userType: UserTypeEnumMap.Member, email: "test@test.com",
        }] });

        // Simulate 5 API calls (e.g. create_room, change_room_texture, etc.)
        for (let i = 0; i < 5; i++)
        {
            const { req, res } = createMockReqRes({ auth_token_dev: "valid-user-1" });
            await UserIdentificationUtil.identifyRegisteredUser(req, res, () => {});
        }

        expect(_mockDBUserUtil.updateLastLogin).not.toHaveBeenCalled();
    });
});

// ─── Tests: a session is never replaced by a guest on a failed lookup ─────

describe("session preservation during identification", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
        _mockDBUserUtil.createUser.mockResolvedValue({ success: true, data: [{ id: "fresh-guest" }] });
    });

    it("a failed lookup does not replace the token's account with a new guest", async () => {
        // The DB could not answer — which says nothing about whether this account exists.
        _mockDBUserUtil.lookUpUserById.mockResolvedValue({ success: false, data: [] });

        const { req, res } = createMockReqRes({ auth_token_dev: "valid-user-1" });
        let nextCalled = false;
        await UserIdentificationUtil.identifyAnyUser(req, res, () => { nextCalled = true; });

        // No guest and no token: overwriting the browser's only token would orphan the account.
        expect(_mockDBUserUtil.createUser).not.toHaveBeenCalled();
        expect(_mockUserTokenUtil.addTokenForUserId).not.toHaveBeenCalled();
        expect(nextCalled).toBe(false);
        expect(res.statusCode).toBe(401);
    });

    it("a token naming a genuinely deleted account still yields a guest on a public route", async () => {
        // The account is gone (e.g. cleaned up), so a guest is correct.
        _mockDBUserUtil.lookUpUserById.mockResolvedValue({ success: true, data: [] });

        const { req, res } = createMockReqRes({ auth_token_dev: "valid-deleted-1" });
        let nextCalled = false;
        await UserIdentificationUtil.identifyAnyUser(req, res, () => { nextCalled = true; });

        expect(_mockDBUserUtil.createUser).toHaveBeenCalledTimes(1);
        expect(nextCalled).toBe(true);
    });

    it("a route reserved for members mints no guest for a visitor holding no token", async () => {
        const { req, res } = createMockReqRes({});
        let nextCalled = false;
        await UserIdentificationUtil.identifyRegisteredUser(req, res, () => { nextCalled = true; });

        // A member-only route is never a first contact, so a new guest (and its issued token) would be wasted.
        expect(_mockDBUserUtil.createUser).not.toHaveBeenCalled();
        expect(_mockUserTokenUtil.addTokenForUserId).not.toHaveBeenCalled();
        expect(nextCalled).toBe(false);
        expect(res.statusCode).toBe(401);
    });
});

/**
 * Mirrors the check in dbUserUtil.updateLastLogin: loginCount increments only when the previous login
 * is at least LOGIN_COUNT_MIN_GAP_MS old, so requests within one visit count once.
 */
function isDistinctLogin(nowMs: number, prevLastLoginAt: number | undefined): boolean
{
    return nowMs - (prevLastLoginAt ?? 0) >= LOGIN_COUNT_MIN_GAP_MS;
}

describe("distinct-login gap for loginCount (Scenario 12)", () => {
    it("minimum gap between distinct logins is one day", () => {
        expect(LOGIN_COUNT_MIN_GAP_MS).toBe(1 * DAY_IN_MS);
    });

    it("requests within the gap belong to the same login", () => {
        const now = Date.now();
        expect(isDistinctLogin(now, now)).toBe(false);
        expect(isDistinctLogin(now, now - 5000)).toBe(false);
        expect(isDistinctLogin(now, now - LOGIN_COUNT_MIN_GAP_MS + 1)).toBe(false);
    });

    it("a request after the gap counts as a new distinct login", () => {
        const now = Date.now();
        expect(isDistinctLogin(now, now - LOGIN_COUNT_MIN_GAP_MS)).toBe(true);
        expect(isDistinctLogin(now, now - 2 * LOGIN_COUNT_MIN_GAP_MS)).toBe(true);
    });

    it("a missing previous login timestamp counts as a distinct login", () => {
        expect(isDistinctLogin(Date.now(), undefined)).toBe(true);
    });
});
