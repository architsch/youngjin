/**
 * Integration tests: Room API routes
 *
 * Tests the HTTP API routes for room management:
 * - Scenario 1:  User creating a room (POST /create_room)
 * - Scenario 9:  User changing room texture pack (POST /change_room_texture)
 *
 * These tests mock the DB layer and call the route handlers directly
 * with mock Express request/response objects.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import User from "../../../src/shared/user/types/user";

// ─── Mock DB modules ──────────────────────────────────────────────────────

const mockFindUserById = vi.fn();
const mockCreateRoom = vi.fn();
const mockSetOwnedRoomID = vi.fn();
const mockGetRoomContent = vi.fn();
const mockGetDBRoom = vi.fn();
const mockChangeRoomTexturePackPath = vi.fn();
const mockSearchUsersWithUserName = vi.fn();

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

function createMockReqRes(user: User, body: any = {}) {
    const req: any = {
        userString: user.toString(),
        body,
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
): Promise<{ statusCode: number; body: any; jsonBody: any }> {
    const { req, res } = createMockReqRes(user, body);

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
        mockGetRoomContent.mockResolvedValue({
            id: "my-room", texturePackPath: "old-texture.jpg",
        });
        mockChangeRoomTexturePackPath.mockReturnValue(undefined);

        // Must be one of the URLs baked into RoomTextureChoiceMap.
        const newTexturePath = "default";
        const res = await callRoute("post", "/change_room_texture", owner, {
            texturePackPath: newTexturePath,
        });

        expect(res.statusCode).toBe(200);
        expect(mockChangeRoomTexturePackPath).toHaveBeenCalledWith(
            expect.objectContaining({ id: "my-room" }),
            newTexturePath,
        );
    });

    it("user without a room cannot change textures", async () => {
        const user = new User("user-1", "NoRoom", UserTypeEnumMap.Member, "noroom@test.com", "", "", "");

        mockFindUserById.mockResolvedValue({
            id: "user-1", userName: "NoRoom", userType: UserTypeEnumMap.Member,
            email: "noroom@test.com", singlePlayerMode: "", lastRoomID: "", ownedRoomID: "",
        });

        const res = await callRoute("post", "/change_room_texture", user, {
            texturePackPath: "new-texture.jpg",
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

        const res = await callRoute("post", "/change_room_texture", owner, {});

        expect(res.statusCode).toBe(400);
        expect(res.body).toContain("texturePackPath");
        expect(mockChangeRoomTexturePackPath).not.toHaveBeenCalled();
    });
});
