/**
 * Scenario tests: FTUE (first-time user experience)
 *
 * The FTUE system shows a coach mark next to a control that a first-time user has not used yet,
 * and remembers — on the user's record — which of those features they have been through, so each
 * one is only ever advertised until it has been discovered. See docs/networking/ftue.md.
 *
 * Covers:
 * - Client side (FTUEUtil): which character each FTUE element is stored as, the local record of
 *   what the user has been through, and when a coach mark is (and is not) put on screen.
 * - The client/server agreement: every element the client can send is one the server accepts.
 * - Server side (UserCommandUtil): the add-FTUE-element command appends to the user's record —
 *   in memory as well as in storage — and turns away duplicates and anything that is not a
 *   storable element.
 * - Persistence: restarting the tutorial wipes the record, the record survives the user wire
 *   format, and user records written before the field existed migrate to an empty one.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Hoisted mock state (vi.mock factories are hoisted, so refs must be too) ─

// The client-side user the FTUE util reads and writes. Assigned per test.
const _clientUser = vi.hoisted(() => ({ current: null as any }));

// Every user command the client emitted, in order.
const _emittedUserCommands = vi.hoisted(() => [] as string[]);

const _mockDBUserUtil = vi.hoisted(() => ({
    setFTUE: vi.fn(async () => ({ success: true, data: [] })),
    setSinglePlayerMode: vi.fn(async () => ({ success: true, data: [] })),
    findUserById: vi.fn(),
    lookUpUserById: vi.fn(async () => ({ success: true, data: [] })),
    fromDBType: vi.fn((u: any) => u),
    createUser: vi.fn(),
    updateLastLogin: vi.fn(),
    setLastRoomID: vi.fn(),
    setOwnedRoomID: vi.fn(),
    savePlayerMetadata: vi.fn(),
    saveMultipleUsersPlayerMetadata: vi.fn(),
    upgradeGuestToMember: vi.fn(),
    deleteStaleGuestsByTier: vi.fn(),
    deleteUser: vi.fn(),
}));

// ─── Apply mocks ──────────────────────────────────────────────────────────
// The client-side util is exercised against a stand-in for the running app: a plain user object
// it can mutate, and a socket client that just records what it was asked to send.

vi.mock("../../../src/client/app", () => ({
    default: {
        getUser: () => _clientUser.current,
    },
}));

vi.mock("../../../src/client/networking/client/socketsClient", () => ({
    default: {
        emitUserCommandSignal: (signal: any) => { _emittedUserCommands.push(signal.message); },
    },
}));

// The real observable module reaches into the 3D client (three.js, gizmo types), which has no
// place in a node test run — but the observable semantics do matter here, so the channel the
// coach marks travel on is a real Observable.
vi.mock("../../../src/client/system/clientObservables", async () => {
    const Observable = (await import("../../../src/shared/system/types/observable")).default;
    return {
        screenCoachMarksObservable: new Observable<{ftueElementCode: number, targetElementId: string, text: string}[]>([]),
    };
});

vi.mock("../../../src/server/db/util/dbUserUtil", () => ({
    default: _mockDBUserUtil,
}));

vi.mock("../../../src/server/db/util/dbSearchUtil", () => ({
    default: {
        rooms: { all: vi.fn(), withRoomType: vi.fn(), withRoomNameAndType: vi.fn() },
        users: { all: vi.fn(), withUserName: vi.fn(), withEmail: vi.fn(), withUserNameOrEmail: vi.fn() },
    },
}));

vi.mock("../../../src/server/room/util/ownedRoomUtil", () => ({
    default: { createOwnedRoom: vi.fn(), setUpFirstOwnedRoom: vi.fn() },
}));

vi.mock("../../../src/client/networking/api/restAPI", () => ({
    default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../../src/server/networking/util/addressUtil", () => ({
    default: {
        getErrorPageURL: (name: string) => `/error/${name}`,
        getEnvStaticURL: () => "http://localhost:3000",
        getEnvDynamicURL: () => "http://localhost:3000",
    },
}));

vi.mock("../../../src/server/user/util/userTokenUtil", () => ({
    default: {
        getUserIdFromToken: vi.fn(),
        addTokenForUserId: vi.fn(),
        clearToken: vi.fn(),
    },
}));

vi.mock("../../../src/server/user/util/userIdentificationUtil", () => ({
    default: {
        // Auth itself is not what these tests are about: a pre-set userString stands in for an
        // identified user, exactly as the real middleware would leave it.
        identifyAnyUser: async (req: any, res: any, next: () => void) => {
            if (req.userString) next();
            else res.status(401).send("Unauthorized");
        },
        identifyRegisteredUser: async (req: any, res: any, next: () => void) => {
            if (req.userString) next();
            else res.status(401).send("Unauthorized");
        },
    },
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

// ─── Import after mocks ───────────────────────────────────────────────────

import FTUEUtil from "../../../src/client/ui/util/ftueUtil";
import { FTUEElementCodeEnumMap } from "../../../src/client/ui/types/ftueElementCode";
import { screenCoachMarksObservable } from "../../../src/client/system/clientObservables";
import UserCommandUtil from "../../../src/server/user/util/userCommandUtil";
import UserCommandSignal from "../../../src/shared/user/types/userCommandSignal";
import UserRouter from "../../../src/server/networking/router/api/userRouter";
import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import { TUTORIAL_SINGLE_PLAYER_MODE } from "../../../src/shared/system/sharedConstants";
import DBUserVersionMigration from "../../../src/server/db/types/versionMigration/dbUserVersionMigration";

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeUser(ftue: string = "", singlePlayerMode: string = ""): User
{
    return new User("user-1", "TestUser", UserTypeEnumMap.Member, "test@test.com",
        singlePlayerMode, "", "", ftue);
}

/** Runs the add-FTUE-element command the way a client would send it. */
async function sendAddFTUEElement(user: User, element: string): Promise<void>
{
    await UserCommandUtil.onUserCommandSignalReceived(user,
        new UserCommandSignal(`addFTUEElement ${element}`));
}

/** Calls a POST route on UserRouter directly, with an already-identified user. */
async function callUserRoute(path: string, user: User): Promise<{statusCode: number, body: any, clearedCookies: string[]}>
{
    const req: any = { userString: user.toString(), body: {}, cookies: {}, ip: "127.0.0.1", headers: {} };
    const res: any = {
        statusCode: 200,
        body: undefined,
        clearedCookies: [] as string[],
        status(code: number) { this.statusCode = code; return this; },
        cookie() { return this; },
        clearCookie(name: string) { this.clearedCookies.push(name); return this; },
    };

    return new Promise((resolve) => {
        res.send = (data: any) => { res.body = data; resolve(res); return res; };
        res.json = (data: any) => { res.body = data; resolve(res); return res; };

        const layer = (UserRouter as any).stack.find(
            (l: any) => l.route && l.route.path === path && l.route.methods["post"]);
        if (!layer)
        {
            res.status(404).send("Route not found");
            return;
        }
        const handlers = layer.route.stack.map((s: any) => s.handle);
        let i = 0;
        const next = () => {
            i++;
            if (i < handlers.length)
                handlers[i](req, res, next);
        };
        handlers[0](req, res, next);
    });
}

const allFTUEElementCodes = Object.values(FTUEElementCodeEnumMap);

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    _emittedUserCommands.length = 0;
    _clientUser.current = makeUser();
    screenCoachMarksObservable.set([]);
});

// ─── Client side: how an experience is recorded ────────────────────────────

describe("FTUE element records (client)", () => {
    it("stores each element as its own letter", () => {
        // Letters only, one per element: the user's record is embedded verbatim in the page that
        // boots the client app, so a quote or a backslash in it would break that page. Distinct,
        // because two features sharing a character would silence each other.
        const chars = new Set<string>();
        for (const code of allFTUEElementCodes)
        {
            _clientUser.current = makeUser();
            FTUEUtil.tryAddFTUEElement(code);
            const stored = _clientUser.current.ftue;
            expect(stored, `element code ${code}`).toMatch(/^[A-Za-z]$/);
            chars.add(stored);
        }
        expect(chars.size).toBe(allFTUEElementCodes.length);
    });

    it("stores every element as the same character it has always been stored as", () => {
        // The mapping is by position and users already have these characters in their records, so a
        // code may never be reassigned. This pins the whole mapping rather than any one element,
        // because the way it breaks is renumbering: a retired element leaves a hole behind, and
        // closing that hole up would silently shift every element after it onto another feature's
        // stored character — handing returning users guidance they have seen and hiding guidance
        // they have not.
        const storedChars: Record<string, string> = {};
        for (const [name, code] of Object.entries(FTUEElementCodeEnumMap))
        {
            _clientUser.current = makeUser();
            FTUEUtil.tryAddFTUEElement(code);
            storedChars[name] = _clientUser.current.ftue;
        }

        expect(storedChars).toEqual({
            CustomizePlayer: "A", // retired element: the slot stays reserved, never reused
            _NOT_USED_: "B", // retired element: the slot stays reserved, never reused
            EnterMyRoom: "C",
            MyRoomSettings: "D",
            AddCanvas: "E",
            ChangeCanvasImage: "F",
            ChangeCanvasFrame: "G",
            EnterHub: "H",
        });
    });

    it("reports an element the user's stored record already carries", () => {
        // What the server sent down for a returning user: they have customized their character.
        FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.CustomizePlayer);
        const returningUserFTUE = _clientUser.current.ftue;

        _clientUser.current = makeUser(returningUserFTUE);
        expect(FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.CustomizePlayer)).toBe(true);
        expect(FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.AddCanvas)).toBe(false);
    });

    it("reports an element as added the moment it is added, without waiting for the server", () => {
        expect(FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.AddCanvas)).toBe(false);
        FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.AddCanvas);
        expect(FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.AddCanvas)).toBe(true);
        expect(_emittedUserCommands.length).toBe(1);
    });

    it("tells the server about an element once, no matter how often the feature is used again", () => {
        FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.ChangeCanvasImage);
        FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.ChangeCanvasImage);
        FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.ChangeCanvasImage);

        expect(_emittedUserCommands.length).toBe(1);
        expect(_clientUser.current.ftue.length).toBe(1);
    });

    it("keeps every element the user goes through in one session", () => {
        FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.AddCanvas);
        FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.ChangeCanvasImage);
        FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.ChangeCanvasFrame);

        expect(_clientUser.current.ftue.length).toBe(3);
        expect(FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.AddCanvas)).toBe(true);
        expect(FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.ChangeCanvasImage)).toBe(true);
        expect(FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.ChangeCanvasFrame)).toBe(true);
    });
});

// ─── Client side: when a coach mark is shown ───────────────────────────────

describe("FTUE coach marks (client)", () => {
    it("puts a coach mark on the control the user has not used yet", () => {
        FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.AddCanvas, "addCanvasButton", "Hang a picture.");

        expect(screenCoachMarksObservable.peek()).toEqual([{
            ftueElementCode: FTUEElementCodeEnumMap.AddCanvas,
            targetElementId: "addCanvasButton",
            text: "Hang a picture.",
        }]);
    });

    it("stays quiet about a feature the user has already been through", () => {
        // Coach marks are scheduled ahead of time, so the user may discover the feature before the
        // mark is due — at which point there is nothing left to say.
        FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.AddCanvas);
        FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.AddCanvas, "addCanvasButton", "Hang a picture.");

        expect(screenCoachMarksObservable.peek()).toEqual([]);
    });

    it("leaves the marks already on screen alone when another one appears", () => {
        // Unrelated features fall due independently of one another, so a mark arriving must not
        // take the place of one the user may still be reading.
        FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.ChangeCanvasImage, "changeCanvasImageButton", "Your picture.");
        FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.ChangeCanvasFrame, "changeCanvasFrameButton", "Your frame.");

        expect(screenCoachMarksObservable.peek().map(mark => mark.targetElementId))
            .toEqual(["changeCanvasImageButton", "changeCanvasFrameButton"]);
    });

    it("keeps one mark per control, no matter how often the trigger fires", () => {
        // A re-triggered mark must neither double the bubble nor extend the stay of the one that
        // is already up, since each mark is taken back down by a clock of its own.
        FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.CustomizePlayer, "customizePlayerButton", "Your look.");
        FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.CustomizePlayer, "customizePlayerButton", "Your look.");

        expect(screenCoachMarksObservable.peek().length).toBe(1);
    });

    it("takes a mark down the moment the user uses the feature it points at", () => {
        FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.AddCanvas, "addCanvasButton", "Hang a picture.");
        FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.AddCanvas);

        expect(screenCoachMarksObservable.peek()).toEqual([]);
    });

    it("leaves the other marks up when one feature is used", () => {
        FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.CustomizePlayer, "customizePlayerButton", "Your look.");
        FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.AddCanvas, "addCanvasButton", "Hang a picture.");

        FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.CustomizePlayer);

        expect(screenCoachMarksObservable.peek().map(mark => mark.targetElementId)).toEqual(["addCanvasButton"]);
    });

    it("leaves a mark up when its target goes off screen, and takes it down only when told to", () => {
        // A mark has no clock of its own: losing sight of the control is not what ends it, so the
        // UI that scheduled it has to take it down explicitly once the control is beyond use.
        // Otherwise the mark would come straight back with the control, skipping the wait that
        // earned it the first time.
        FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.MyRoomSettings, "configureMyRoomButton", "Your room.");
        FTUEUtil.hideCoachMark(FTUEElementCodeEnumMap.MyRoomSettings);

        expect(screenCoachMarksObservable.peek()).toEqual([]);

        // Still unexperienced, so the guidance is not lost — it is offered afresh next time.
        expect(FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.MyRoomSettings)).toBe(false);
        FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.MyRoomSettings, "configureMyRoomButton", "Your room.");
        expect(screenCoachMarksObservable.peek().map(mark => mark.targetElementId))
            .toEqual(["configureMyRoomButton"]);
    });

    it("shows a mark without recording anything, so the control still has to be used", () => {
        // Showing guidance is an offer, not the experience itself: every element is recorded by the
        // user's own use of its control, never by the mark going up.
        FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.CustomizePlayer, "customizePlayerButton", "Your look.");

        expect(FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.CustomizePlayer)).toBe(false);
        expect(_emittedUserCommands.length).toBe(0);
    });
});

// ─── Client and server agree on the stored form ────────────────────────────

describe("FTUE client/server agreement", () => {
    it("the server accepts every element the client can send", async () => {
        // The client owns which elements exist and the server owns what may be stored, so the two
        // could drift apart silently — with the user's progress quietly never being saved.
        for (const code of allFTUEElementCodes)
        {
            _clientUser.current = makeUser();
            _emittedUserCommands.length = 0;
            FTUEUtil.tryAddFTUEElement(code);

            const serverUser = makeUser();
            await UserCommandUtil.onUserCommandSignalReceived(serverUser,
                new UserCommandSignal(_emittedUserCommands[0]));

            expect(serverUser.ftue, `element code ${code}`).toBe(_clientUser.current.ftue);
            expect(_mockDBUserUtil.setFTUE).toHaveBeenLastCalledWith(serverUser.id, serverUser.ftue);
        }
    });
});

// ─── Server side: the add-FTUE-element command ─────────────────────────────

describe("FTUE user command (server)", () => {
    it("appends the element to the user's record and persists it", async () => {
        const user = makeUser();
        await sendAddFTUEElement(user, "A");

        expect(user.ftue).toBe("A");
        expect(_mockDBUserUtil.setFTUE).toHaveBeenCalledTimes(1);
        expect(_mockDBUserUtil.setFTUE).toHaveBeenCalledWith("user-1", "A");
    });

    it("accumulates elements across one session rather than overwriting", async () => {
        // The user object lives for the whole socket session, so an element added earlier must
        // still be there when the next one arrives — otherwise the last write wins and everything
        // the user did before it is forgotten.
        const user = makeUser();
        await sendAddFTUEElement(user, "A");
        await sendAddFTUEElement(user, "B");
        await sendAddFTUEElement(user, "C");

        expect(user.ftue).toBe("ABC");
        expect(_mockDBUserUtil.setFTUE).toHaveBeenLastCalledWith("user-1", "ABC");
    });

    it("keeps whatever the user already had stored", async () => {
        const user = makeUser("AB");
        await sendAddFTUEElement(user, "C");

        expect(user.ftue).toBe("ABC");
    });

    it("ignores an element the user already has", async () => {
        const user = makeUser("AB");
        await sendAddFTUEElement(user, "B");

        expect(user.ftue).toBe("AB");
        expect(_mockDBUserUtil.setFTUE).not.toHaveBeenCalled();
    });

    it("stores nothing that is not a single letter", async () => {
        // Only letters may reach the record: it is embedded verbatim in the page that boots the
        // client app, so a quote or a backslash would break that page for this user.
        for (const element of ["", "AB", "1", "\"", "\\", "<", " ", "$"])
        {
            const user = makeUser();
            await sendAddFTUEElement(user, element);
            expect(user.ftue, `element "${element}"`).toBe("");
        }
        expect(_mockDBUserUtil.setFTUE).not.toHaveBeenCalled();
    });

    it("ignores an unknown command without touching the record", async () => {
        const user = makeUser("A");
        await UserCommandUtil.onUserCommandSignalReceived(user, new UserCommandSignal("addFTUEElements A B"));

        expect(user.ftue).toBe("A");
        expect(_mockDBUserUtil.setFTUE).not.toHaveBeenCalled();
    });
});

// ─── Persistence ──────────────────────────────────────────────────────────

describe("FTUE persistence", () => {
    it("restarting the tutorial wipes the record, so the guidance runs again", async () => {
        const res = await callUserRoute("/restart_tutorial", makeUser("ABC"));

        expect(res.statusCode).toBe(200);
        expect(_mockDBUserUtil.setSinglePlayerMode).toHaveBeenCalledWith("user-1", TUTORIAL_SINGLE_PLAYER_MODE);
        expect(_mockDBUserUtil.setFTUE).toHaveBeenCalledWith("user-1", "");
    });

    it("does not wipe the record when the tutorial cannot be restarted", async () => {
        // A user already in a single-player mode is refused, and refusing must change nothing.
        const res = await callUserRoute("/restart_tutorial", makeUser("ABC", TUTORIAL_SINGLE_PLAYER_MODE));

        expect(res.statusCode).toBe(409);
        expect(_mockDBUserUtil.setFTUE).not.toHaveBeenCalled();
        expect(_mockDBUserUtil.setSinglePlayerMode).not.toHaveBeenCalled();
    });

    it("carries the record across the user wire format", () => {
        const restored = User.fromString(makeUser("ABC").toString());
        expect(restored.ftue).toBe("ABC");
    });

    it("treats a user string written before the record existed as an empty record", () => {
        // Fields are positional, so a string from a client/server that predates the FTUE field
        // simply ends where the field would have been.
        const legacyUserString = `user-1 TestUser ${UserTypeEnumMap.Member} test@test.com  room-1`;
        expect(User.fromString(legacyUserString).ftue).toBe("");
    });

    it("migrates a user record written before the field existed to an empty record", async () => {
        // Existing users start out with everything still to discover, rather than being treated as
        // having already seen it all.
        let row: any = {
            id: "user-1", userName: "TestUser", userType: UserTypeEnumMap.Member,
            email: "test@test.com", tutorialStep: 3, totalPlaytimeMs: 1000,
            lastRoomID: "room-1", ownedRoomID: "", version: 0,
        };
        for (let version = 0; version < DBUserVersionMigration.length; ++version)
            row = await DBUserVersionMigration[version](row);

        expect(row.ftue).toBe("");
        expect(row.lastRoomID).toBe("room-1"); // the rest of the record is left alone
    });
});
