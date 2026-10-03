/**
 * Integration tests: room API routes (/create_room, /change_room_texture, /change_room_prefs,
 * /load_room_file), called directly with mock Express objects and a mocked DB.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import User from "../../../src/shared/user/types/user";
import RoomFile from "../../../src/shared/room/types/roomFile";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import { createTestRoom } from "../helpers/roomContent";

// ─── Mock DB modules ──────────────────────────────────────────────────────

const mockFindUserById = vi.fn();
const mockCreateRoom = vi.fn();
const mockSetOwnedRoomID = vi.fn();
const mockGetRoomContent = vi.fn();
const mockGetDBRoom = vi.fn();
const mockChangeRoomTexturePackPath = vi.fn();
const mockChangeRoomPrefs = vi.fn();
const mockLoadRoomFile = vi.fn();
const mockSearchUsersWithUserName = vi.fn();

// Which room each user stands in, and the rooms held in memory, as ServerRoomManager keeps them.
const mockRoomManagerState = vi.hoisted(() => ({
    currentRoomIDByUserID: {} as {[userID: string]: string},
    roomRuntimeMemories: {} as {[roomID: string]: {room: any}},
}));

vi.mock("../../../src/server/db/util/dbUserUtil", () => ({
    default: {
        findUserById: (...args: any[]) => mockFindUserById(...args),
        lookUpUserById: async (...args: any[]) => {
            const user = await mockFindUserById(...args);
            return { success: true, data: user ? [user] : [] };
        },
        createUser: vi.fn(async () => ({ success: true, data: [{ id: "new-user" }] })),
        setOwnedRoomID: (...args: any[]) => mockSetOwnedRoomID(...args),
        setLastRoomID: vi.fn(async () => {}),
        savePlayerMetadata: vi.fn(async () => {}),
        saveMultipleUsersPlayerMetadata: vi.fn(async () => {}),
        setSinglePlayerMode: vi.fn(async () => ({ success: true, data: [] })),
        deleteStaleGuestsByTier: vi.fn(async () => 0),
        deleteUser: vi.fn(async () => ({ success: true, data: [] })),
        fromDBType: vi.fn((u: any) => u),
        updateLastLogin: vi.fn(async () => {}),
        upgradeGuestToMember: vi.fn(async () => ({ success: true, data: [] })),
    },
}));

vi.mock("../../../src/server/db/util/dbRoomUtil", () => ({
    default: {
        getRoomContent: (...args: any[]) => mockGetRoomContent(...args),
        getDBRoom: (...args: any[]) => mockGetDBRoom(...args),
        saveRoomContent: vi.fn(async () => true),
        deleteRoomContent: vi.fn(async () => true),
        createRoom: (...args: any[]) => mockCreateRoom(...args),
        deleteRoom: vi.fn(async () => true),
        changeRoomTexturePackPath: (...args: any[]) => mockChangeRoomTexturePackPath(...args),
    },
}));

vi.mock("../../../src/server/db/util/dbSearchUtil", () => ({
    default: {
        rooms: {
            all: vi.fn(async () => ({ success: true, data: [] })),
            withRoomType: vi.fn(async () => ({ success: true, data: [] })),
        },
        users: {
            all: vi.fn(async () => ({ success: true, data: [] })),
            withUserName: (...args: any[]) => mockSearchUsersWithUserName(...args),
            withEmail: vi.fn(async () => ({ success: true, data: [] })),
            withUserNameOrEmail: vi.fn(async () => ({ success: true, data: [] })),
        },
    },
}));

vi.mock("../../../src/server/room/serverRoomManager", () => ({
    default: {
        changeRoomTexturePack: vi.fn(async (_room: any, _path: string) => {
            mockChangeRoomTexturePackPath(_room, _path);
            return true;
        }),
        changeRoomPrefs: vi.fn(async (_room: any, _prefs: string) => {
            mockChangeRoomPrefs(_room, _prefs);
            return true;
        }),
        currentRoomIDByUserID: mockRoomManagerState.currentRoomIDByUserID,
        roomRuntimeMemories: mockRoomManagerState.roomRuntimeMemories,
        loadRoomFile: (...args: any[]) => mockLoadRoomFile(...args),
    },
}));

vi.mock("../../../src/server/networking/util/addressUtil", () => ({
    default: {
        getErrorPageURL: (name: string) => `/error/${name}`,
        getEnvStaticURL: () => "http://localhost:3000",
        getEnvDynamicURL: () => "http://localhost:3000",
    },
}));

vi.mock("../../../src/server/user/util/userIdentificationUtil", () => ({
    default: {
        identifyRegisteredUser: async (req: any, res: any, next: () => void) => {
            // In tests, we pre-set req.userString to bypass real auth
            if (req.userString) {
                next();
            } else {
                res.status(401).send("Unauthorized");
            }
        },
        identifyAnyUser: async (req: any, res: any, next: () => void) => {
            if (req.userString) {
                next();
            } else {
                res.status(401).send("Unauthorized");
            }
        },
        // As the real one: the identified user has to be an admin.
        identifyAdmin: async (req: any, res: any, next: () => void) => {
            if (!req.userString) {
                res.status(401).send("Unauthorized");
            } else if (User.fromString(req.userString).userType !== UserTypeEnumMap.Admin) {
                res.status(403).send("User doesn't satisfy the pass-condition.");
            } else {
                next();
            }
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

// ─── Import router after mocks ───────────────────────────────────────────

import RoomRouter from "../../../src/server/networking/router/api/roomRouter";
import express from "express";

// ─── Helpers ──────────────────────────────────────────────────────────────

function createMockReqRes(user: User, body: any = {}, query: any = {}) {
    const req: any = {
        userString: user.toString(),
        body,
        query,
        cookies: {},
        ip: "127.0.0.1",
        headers: { "user-agent": "test" },
    };
    const res: any = {
        statusCode: 200,
        body: undefined,
        jsonBody: undefined,
        status(code: number) { this.statusCode = code; return this; },
        send(data: any) { this.body = data; return this; },
        json(data: any) { this.jsonBody = data; return this; },
        cookie() { return this; },
    };
    return { req, res };
}

// ─── Helper to call route handler directly ────────────────────────────────

async function callRoute(
    method: "post",
    path: string,
    user: User,
    body: any = {},
    query: any = {},
): Promise<{ statusCode: number; body: any; jsonBody: any }> {
    const { req, res } = createMockReqRes(user, body, query);

    // Find the matching route handler in the router
    const app = express();
    app.use(express.json());

    // Wrap our test into a promise
    return new Promise((resolve) => {
        // Override res methods to resolve on response
        const origSend = res.send.bind(res);
        const origJson = res.json.bind(res);
        res.send = (data: any) => { origSend(data); resolve(res); return res; };
        res.json = (data: any) => { origJson(data); resolve(res); return res; };

        // Mount the router and make a test request
        app.use("/", RoomRouter);

        // Simulate the request by finding and calling the route handler stack
        const layer = (RoomRouter as any).stack.find(
            (l: any) => l.route && l.route.path === path && l.route.methods[method]
        );
        if (!layer) {
            res.status(404).send("Route not found");
            return;
        }

        // Execute the middleware chain: first the identification middleware, then the handler
        const handlers = layer.route.stack.map((s: any) => s.handle);
        let i = 0;
        const next = () => {
            i++;
            if (i < handlers.length) {
                handlers[i](req, res, next);
            }
        };
        handlers[0](req, res, next);
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("room API: create room (Scenario 1)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("registered user can create a room", async () => {
        const user = new User("user-1", "TestUser", UserTypeEnumMap.Member, "test@test.com", "", "", "");

        mockFindUserById.mockResolvedValue({
            id: "user-1", userName: "TestUser", userType: UserTypeEnumMap.Member,
            email: "test@test.com", singlePlayerMode: "", lastRoomID: "", ownedRoomID: "",
        });
        mockCreateRoom.mockResolvedValue({ success: true, data: [{ id: "new-room-1" }] });
        mockSetOwnedRoomID.mockResolvedValue({ success: true, data: [] });

        const res = await callRoute("post", "/create_room", user);

        expect(res.statusCode).toBe(200);
        expect(res.jsonBody).toEqual({ roomID: "new-room-1" });
        expect(mockCreateRoom).toHaveBeenCalledOnce();
        expect(mockSetOwnedRoomID).toHaveBeenCalledWith("user-1", "new-room-1");
    });

    it("guest user cannot create a room", async () => {
        const user = new User("guest-1", "Guest", UserTypeEnumMap.Guest, "", "", "", "");

        const res = await callRoute("post", "/create_room", user);

        expect(res.statusCode).toBe(403);
        expect(res.body).toContain("Guest");
        expect(mockCreateRoom).not.toHaveBeenCalled();
    });

    it("user who already owns a room cannot create another", async () => {
        const user = new User("user-1", "TestUser", UserTypeEnumMap.Member, "test@test.com", "", "", "existing-room");

        mockFindUserById.mockResolvedValue({
            id: "user-1", userName: "TestUser", userType: UserTypeEnumMap.Member,
            email: "test@test.com", singlePlayerMode: "", lastRoomID: "", ownedRoomID: "existing-room",
        });

        const res = await callRoute("post", "/create_room", user);

        expect(res.statusCode).toBe(409);
        expect(res.body).toContain("already owns");
        expect(mockCreateRoom).not.toHaveBeenCalled();
    });
});

describe("room API: change room texture pack (Scenario 9)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("room owner can change the texture pack", async () => {
        const owner = new User("owner-1", "Owner", UserTypeEnumMap.Member, "owner@test.com", "", "", "my-room");

        mockFindUserById.mockResolvedValue({
            id: "owner-1", userName: "Owner", userType: UserTypeEnumMap.Member,
            email: "owner@test.com", singlePlayerMode: "", lastRoomID: "", ownedRoomID: "my-room",
        });
        mockGetDBRoom.mockResolvedValue({
            id: "my-room", roomType: RoomTypeEnumMap.Regular, ownerUserID: "owner-1",
        });
        mockGetRoomContent.mockResolvedValue({
            id: "my-room", texturePackPath: "old-texture.jpg",
        });
        mockChangeRoomTexturePackPath.mockReturnValue(undefined);

        // Must be one of the URLs baked into RoomTextureChoiceMap.
        const newTexturePath = "default";
        const res = await callRoute("post", "/change_room_texture", owner, {
            texturePackPath: newTexturePath, roomID: "my-room",
        });

        expect(res.statusCode).toBe(200);
        expect(mockChangeRoomTexturePackPath).toHaveBeenCalledWith(
            expect.objectContaining({ id: "my-room" }),
            newTexturePath,
        );
    });

    it("a member cannot change another member's room's texture", async () => {
        const user = new User("user-1", "NoRoom", UserTypeEnumMap.Member, "noroom@test.com", "", "", "");

        mockFindUserById.mockResolvedValue({
            id: "user-1", userName: "NoRoom", userType: UserTypeEnumMap.Member,
            email: "noroom@test.com", singlePlayerMode: "", lastRoomID: "", ownedRoomID: "",
        });
        mockGetDBRoom.mockResolvedValue({
            id: "someone-elses-room", roomType: RoomTypeEnumMap.Regular, ownerUserID: "owner-1",
        });

        const res = await callRoute("post", "/change_room_texture", user, {
            texturePackPath: "new-texture.jpg", roomID: "someone-elses-room",
        });

        expect(res.statusCode).toBe(403);
        expect(mockChangeRoomTexturePackPath).not.toHaveBeenCalled();
    });

    it("request without texturePackPath is rejected", async () => {
        const owner = new User("owner-1", "Owner", UserTypeEnumMap.Member, "owner@test.com", "", "", "my-room");

        mockFindUserById.mockResolvedValue({
            id: "owner-1", userName: "Owner", userType: UserTypeEnumMap.Member,
            email: "owner@test.com", singlePlayerMode: "", lastRoomID: "", ownedRoomID: "my-room",
        });

        const res = await callRoute("post", "/change_room_texture", owner, { roomID: "my-room" });

        expect(res.statusCode).toBe(400);
        expect(res.body).toContain("texturePackPath");
        expect(mockChangeRoomTexturePackPath).not.toHaveBeenCalled();
    });

    it("request that names no room is rejected", async () => {
        const owner = new User("owner-1", "Owner", UserTypeEnumMap.Member, "owner@test.com", "", "", "my-room");

        const res = await callRoute("post", "/change_room_texture", owner, {
            texturePackPath: "default",
        });

        expect(res.statusCode).toBe(400);
        expect(res.body).toContain("roomID");
        expect(mockChangeRoomTexturePackPath).not.toHaveBeenCalled();
    });
});

describe("room API: change room lighting (Scenario 10)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    const ownerRow = {
        id: "owner-1", userName: "Owner", userType: UserTypeEnumMap.Member,
        email: "owner@test.com", singlePlayerMode: "", lastRoomID: "", ownedRoomID: "my-room",
    };
    const owner = () => new User("owner-1", "Owner", UserTypeEnumMap.Member, "owner@test.com", "", "", "my-room");
    const ownedRoomRow = {
        id: "my-room", roomType: RoomTypeEnumMap.Regular, ownerUserID: "owner-1",
    };
    // A hub belongs to nobody, which is exactly why ownership can never reach one.
    const hubRow = { id: "some-hub", roomType: RoomTypeEnumMap.Hub, ownerUserID: "" };

    it("room owner can re-light their own room", async () => {
        mockFindUserById.mockResolvedValue(ownerRow);
        mockGetDBRoom.mockResolvedValue(ownedRoomRow);
        mockGetRoomContent.mockResolvedValue({ id: "my-room", prefs: "" });

        const res = await callRoute("post", "/change_room_prefs", owner(),
            { prefs: "!!!!!!", roomID: "my-room" });

        expect(res.statusCode).toBe(200);
        expect(mockChangeRoomPrefs).toHaveBeenCalledWith(
            expect.objectContaining({ id: "my-room" }), "!!!!!!");
    });

    it("passes a nonsense value straight through, for the manager to canonicalize", async () => {
        // The route only checks for a string; the ServerRoomManager round trip makes quantized values safe.
        mockFindUserById.mockResolvedValue(ownerRow);
        mockGetDBRoom.mockResolvedValue(ownedRoomRow);
        mockGetRoomContent.mockResolvedValue({ id: "my-room", prefs: "" });

        const res = await callRoute("post", "/change_room_prefs", owner(),
            { prefs: "nonsense", roomID: "my-room" });

        expect(res.statusCode).toBe(200);
        expect(mockChangeRoomPrefs).toHaveBeenCalledWith(expect.anything(), "nonsense");
    });

    it("accepts the empty string, which is what an unconfigured room holds", async () => {
        mockFindUserById.mockResolvedValue(ownerRow);
        mockGetDBRoom.mockResolvedValue(ownedRoomRow);
        mockGetRoomContent.mockResolvedValue({ id: "my-room", prefs: "abc" });

        const res = await callRoute("post", "/change_room_prefs", owner(),
            { prefs: "", roomID: "my-room" });

        expect(res.statusCode).toBe(200);
        expect(mockChangeRoomPrefs).toHaveBeenCalledWith(expect.anything(), "");
    });

    it("request with no prefs at all is rejected", async () => {
        mockFindUserById.mockResolvedValue(ownerRow);

        const res = await callRoute("post", "/change_room_prefs", owner(), { roomID: "my-room" });

        expect(res.statusCode).toBe(400);
        expect(res.body).toContain("prefs");
        expect(mockChangeRoomPrefs).not.toHaveBeenCalled();
    });

    it("request that names no room is rejected", async () => {
        mockFindUserById.mockResolvedValue(ownerRow);

        const res = await callRoute("post", "/change_room_prefs", owner(), { prefs: "!!!!!!" });

        expect(res.statusCode).toBe(400);
        expect(res.body).toContain("roomID");
        expect(mockChangeRoomPrefs).not.toHaveBeenCalled();
    });

    it("a member cannot re-light a room he does not own", async () => {
        const user = new User("user-1", "NoRoom", UserTypeEnumMap.Member, "noroom@test.com", "", "", "");
        mockFindUserById.mockResolvedValue({
            id: "user-1", userName: "NoRoom", userType: UserTypeEnumMap.Member,
            email: "noroom@test.com", singlePlayerMode: "", lastRoomID: "", ownedRoomID: "",
        });
        mockGetDBRoom.mockResolvedValue(ownedRoomRow);

        const res = await callRoute("post", "/change_room_prefs", user,
            { prefs: "!!!!!!", roomID: "my-room" });

        expect(res.statusCode).toBe(403);
        expect(mockChangeRoomPrefs).not.toHaveBeenCalled();
    });

    it("a member cannot re-light a hub", async () => {
        const member = new User("member-1", "Member", UserTypeEnumMap.Member, "m@test.com", "", "", "my-room");
        mockFindUserById.mockResolvedValue({
            id: "member-1", userName: "Member", userType: UserTypeEnumMap.Member,
            email: "m@test.com", singlePlayerMode: "", lastRoomID: "", ownedRoomID: "my-room",
        });
        mockGetDBRoom.mockResolvedValue(hubRow);

        const res = await callRoute("post", "/change_room_prefs", member,
            { prefs: "!!!!!!", roomID: "some-hub" });

        expect(res.statusCode).toBe(403);
        expect(mockChangeRoomPrefs).not.toHaveBeenCalled();
    });

    it("an admin can re-light a hub, which nobody owns", async () => {
        const admin = new User("admin-1", "Admin", UserTypeEnumMap.Admin, "a@test.com", "", "", "");
        mockFindUserById.mockResolvedValue({
            id: "admin-1", userName: "Admin", userType: UserTypeEnumMap.Admin,
            email: "a@test.com", singlePlayerMode: "", lastRoomID: "", ownedRoomID: "",
        });
        mockGetDBRoom.mockResolvedValue(hubRow);
        mockGetRoomContent.mockResolvedValue({ id: "some-hub", prefs: "" });

        const res = await callRoute("post", "/change_room_prefs", admin,
            { prefs: "!!!!!!", roomID: "some-hub" });

        expect(res.statusCode).toBe(200);
        expect(mockChangeRoomPrefs).toHaveBeenCalledWith(
            expect.objectContaining({ id: "some-hub" }), "!!!!!!");
    });

    it("an admin still cannot re-light somebody else's private room", async () => {
        const admin = new User("admin-1", "Admin", UserTypeEnumMap.Admin, "a@test.com", "", "", "");
        mockFindUserById.mockResolvedValue({
            id: "admin-1", userName: "Admin", userType: UserTypeEnumMap.Admin,
            email: "a@test.com", singlePlayerMode: "", lastRoomID: "", ownedRoomID: "",
        });
        mockGetDBRoom.mockResolvedValue(ownedRoomRow);

        const res = await callRoute("post", "/change_room_prefs", admin,
            { prefs: "!!!!!!", roomID: "my-room" });

        expect(res.statusCode).toBe(403);
        expect(mockChangeRoomPrefs).not.toHaveBeenCalled();
    });
});

describe("room API: load room file", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});

        for (const userID in mockRoomManagerState.currentRoomIDByUserID)
            delete mockRoomManagerState.currentRoomIDByUserID[userID];
        for (const roomID in mockRoomManagerState.roomRuntimeMemories)
            delete mockRoomManagerState.roomRuntimeMemories[roomID];
        mockLoadRoomFile.mockResolvedValue(true);
    });

    const makeAdmin = (ownedRoomID: string = "") =>
        new User("admin-1", "Admin", UserTypeEnumMap.Admin, "a@test.com", "", "", ownedRoomID);

    // A room file as a client sends one: the request's whole body.
    function makeRoomFileBody(): Buffer
    {
        const bufferState = EncodingUtil.startEncoding();
        RoomFile.fromRoom(createTestRoom("saved-room", "", RoomTypeEnumMap.Hub)).encode(bufferState);
        return Buffer.from(EncodingUtil.endEncoding(bufferState));
    }

    // Stands the user in a loaded room of the given type and owner.
    function standIn(user: User, roomID: string, roomType: number, ownerUserID: string = "")
    {
        mockRoomManagerState.currentRoomIDByUserID[user.id] = roomID;
        mockRoomManagerState.roomRuntimeMemories[roomID] =
            { room: createTestRoom(roomID, "", roomType, ownerUserID) };
    }

    it("an admin can load a file over the hub he stands in", async () => {
        const admin = makeAdmin();
        standIn(admin, "some-hub", RoomTypeEnumMap.Hub);

        const res = await callRoute("post", "/load_room_file", admin, makeRoomFileBody(), { roomID: "some-hub" });

        expect(res.statusCode).toBe(200);
        expect(mockLoadRoomFile).toHaveBeenCalledExactlyOnceWith("some-hub", expect.any(RoomFile));

        // Read for the room it is loaded into, not the one it was saved from.
        const roomFile = mockLoadRoomFile.mock.calls[0][1] as RoomFile;
        const objects = Object.values(roomFile.objectGroup.objectById);
        expect(objects.length).toBeGreaterThan(0);
        for (const obj of objects)
            expect(obj.roomID).toBe("some-hub");
    });

    it("an admin can load a file over his own room", async () => {
        const admin = makeAdmin("my-room");
        standIn(admin, "my-room", RoomTypeEnumMap.Regular, admin.id);

        const res = await callRoute("post", "/load_room_file", admin, makeRoomFileBody(), { roomID: "my-room" });

        expect(res.statusCode).toBe(200);
        expect(mockLoadRoomFile).toHaveBeenCalledExactlyOnceWith("my-room", expect.any(RoomFile));
    });

    it("a member cannot load a file, even over his own room", async () => {
        const owner = new User("owner-1", "Owner", UserTypeEnumMap.Member, "owner@test.com", "", "", "my-room");
        standIn(owner, "my-room", RoomTypeEnumMap.Regular, owner.id);

        const res = await callRoute("post", "/load_room_file", owner, makeRoomFileBody(), { roomID: "my-room" });

        expect(res.statusCode).toBe(403);
        expect(mockLoadRoomFile).not.toHaveBeenCalled();
    });

    it("an admin cannot load a file over somebody else's private room", async () => {
        const admin = makeAdmin();
        standIn(admin, "my-room", RoomTypeEnumMap.Regular, "owner-1");

        const res = await callRoute("post", "/load_room_file", admin, makeRoomFileBody(), { roomID: "my-room" });

        expect(res.statusCode).toBe(403);
        expect(mockLoadRoomFile).not.toHaveBeenCalled();
    });

    it("an admin cannot load a file over a room he is not in", async () => {
        const admin = makeAdmin();
        standIn(admin, "some-hub", RoomTypeEnumMap.Hub);
        mockRoomManagerState.roomRuntimeMemories["other-hub"] =
            { room: createTestRoom("other-hub", "", RoomTypeEnumMap.Hub) };

        const res = await callRoute("post", "/load_room_file", admin, makeRoomFileBody(), { roomID: "other-hub" });

        expect(res.statusCode).toBe(409);
        expect(mockLoadRoomFile).not.toHaveBeenCalled();
    });

    it("request that names no room is rejected", async () => {
        const admin = makeAdmin();
        standIn(admin, "some-hub", RoomTypeEnumMap.Hub);

        const res = await callRoute("post", "/load_room_file", admin, makeRoomFileBody());

        expect(res.statusCode).toBe(400);
        expect(res.body).toContain("roomID");
        expect(mockLoadRoomFile).not.toHaveBeenCalled();
    });

    it("a body that is not a room file is rejected", async () => {
        const admin = makeAdmin();
        standIn(admin, "some-hub", RoomTypeEnumMap.Hub);

        // Some other file, a room file cut short, and a body that is no file at all.
        const wholeFile = makeRoomFileBody();
        for (const body of [Buffer.from("not a room"), wholeFile.subarray(0, wholeFile.length - 1), {}])
        {
            const res = await callRoute("post", "/load_room_file", admin, body, { roomID: "some-hub" });
            expect(res.statusCode).toBe(400);
        }
        expect(mockLoadRoomFile).not.toHaveBeenCalled();
    });

    it("reports a load the server could not carry out", async () => {
        const admin = makeAdmin();
        standIn(admin, "some-hub", RoomTypeEnumMap.Hub);
        mockLoadRoomFile.mockResolvedValue(false);

        const res = await callRoute("post", "/load_room_file", admin, makeRoomFileBody(), { roomID: "some-hub" });

        expect(res.statusCode).toBe(500);
    });
});
