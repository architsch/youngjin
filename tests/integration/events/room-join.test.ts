/**
 * Event: User joining a room.
 *
 * Covers criteria items:
 * - User joining a room which hasn't been loaded yet in RoomManager
 * - User joining a room which has already been loaded in RoomManager
 * - Joining a non-existent room (invalid parameters)
 * - Rapidly switching rooms
 * - Cross-user visibility (position, metadata)
 * - Room-specific state independence
 * - Room switching saves previous room's state
 * - Last user leaving unloads the room
 */
import { describe, it, expect, beforeEach } from "vitest";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import RoomManager from "../../../src/server/room/roomManager";

describe("room join events", () => {
    beforeEach(() => {
        harness.reset();
    });

    // ─── Join unloaded room ─────────────────────────────────────────────────

    it("joining an unloaded room triggers loadRoom", async () => {
        harness.seedRoom("unloaded-room", "Unloaded", RoomTypeEnumMap.Regular);
        expect(harness.isRoomLoaded("unloaded-room")).toBe(false);

        const ctx = harness.connectUser();
        const result = await harness.joinRoom(ctx, "unloaded-room");

        expect(result).toBe(true);
        expect(harness.isRoomLoaded("unloaded-room")).toBe(true);
        expect(harness.getRoomParticipantCount("unloaded-room")).toBe(1);
    });

    // ─── Join loaded room ───────────────────────────────────────────────────

    it("joining an already-loaded room adds user without reloading", async () => {
        harness.seedRoom("loaded-room", "Loaded", RoomTypeEnumMap.Regular);

        // First user loads the room
        const first = harness.connectUser();
        await harness.joinRoom(first, "loaded-room");
        expect(harness.isRoomLoaded("loaded-room")).toBe(true);

        // Second user joins the already-loaded room
        const second = harness.connectUser();
        const result = await harness.joinRoom(second, "loaded-room");

        expect(result).toBe(true);
        expect(harness.getRoomParticipantCount("loaded-room")).toBe(2);
    });

    // ─── Join non-existent room ─────────────────────────────────────────────

    it("joining a non-existent room returns false gracefully", async () => {
        const ctx = harness.connectUser();
        const result = await harness.joinRoom(ctx, "does-not-exist");
        expect(result).toBe(false);
    });

    // ─── Rapid room switching ───────────────────────────────────────────────

    it("handles a user rapidly switching rooms", async () => {
        harness.seedRoom("rapid-1", "Rapid 1", RoomTypeEnumMap.Regular);
        harness.seedRoom("rapid-2", "Rapid 2", RoomTypeEnumMap.Regular);
        harness.seedRoom("rapid-3", "Rapid 3", RoomTypeEnumMap.Regular);

        const ctx = harness.connectUser();

        const roomCycle = ["rapid-1", "rapid-2", "rapid-3"];
        for (let i = 0; i < 10; i++)
        {
            const roomID = roomCycle[i % roomCycle.length];
            const prevRoomExists = i > 0;
            await harness.RoomManager.changeUserRoom(ctx.socketUserContext, roomID, prevRoomExists, false);
        }

        const finalRoom = roomCycle[9 % roomCycle.length];
        expect(RoomManager.currentRoomIDByUserID[ctx.user.id]).toBe(finalRoom);
        expect(harness.getRoomParticipantCount(finalRoom)).toBe(1);

        // Other rooms should be unloaded
        for (const roomID of roomCycle)
        {
            if (roomID !== finalRoom)
                expect(harness.isRoomLoaded(roomID)).toBe(false);
        }
    });

    // ─── Cross-user visibility ──────────────────────────────────────────────

    it("other users see the joining player's correct position", async () => {
        harness.seedRoom("vis-room", "Visibility Room", RoomTypeEnumMap.Regular);

        const observer = harness.connectUser();
        await harness.joinRoom(observer, "vis-room");

        const joiner = harness.connectUser({ lastX: 7, lastY: 0, lastZ: 28 });
        await harness.joinRoom(joiner, "vis-room");

        const roomMem = RoomManager.roomRuntimeMemories["vis-room"];
        const joinerObj = roomMem.playerObjectMemoryByUserID[joiner.user.id];
        expect(joinerObj).toBeDefined();
        expect(joinerObj.objectSpawnParams.transform.x).toBeCloseTo(7);
        expect(joinerObj.objectSpawnParams.transform.z).toBeCloseTo(28);
        expect(joinerObj.objectSpawnParams.sourceUserID).toBe(joiner.user.id);
        expect(joinerObj.objectSpawnParams.sourceUserName).toBe(joiner.user.userName);
    });

    it("other users see the joining player's correct metadata", async () => {
        harness.seedRoom("meta-vis-room", "Meta Vis Room", RoomTypeEnumMap.Regular);

        const observer = harness.connectUser();
        await harness.joinRoom(observer, "meta-vis-room");

        const joiner = harness.connectUser({
            playerMetadata: { "0": "custom-emote", "1": "special-room" },
        });
        await harness.joinRoom(joiner, "meta-vis-room");

        const roomMem = RoomManager.roomRuntimeMemories["meta-vis-room"];
        const joinerObj = roomMem.playerObjectMemoryByUserID[joiner.user.id];
        expect(joinerObj).toBeDefined();
        expect(joinerObj.objectSpawnParams.metadata[0]?.str).toBe("custom-emote");
        expect(joinerObj.objectSpawnParams.metadata[1]?.str).toBe("special-room");
    });

    it("all participants see consistent object state for every player", async () => {
        harness.seedRoom("all-vis-room", "All Vis Room", RoomTypeEnumMap.Regular);

        const N = 6;
        const users: ConnectedUser[] = [];

        for (let i = 0; i < N; i++)
        {
            const ctx = harness.connectUser({
                lastX: 5 + i * 4, lastZ: 5 + i * 3,
                playerMetadata: { "0": `msg-${i}` },
            });
            await harness.joinRoom(ctx, "all-vis-room");
            users.push(ctx);
        }

        const roomMem = RoomManager.roomRuntimeMemories["all-vis-room"];
        expect(Object.keys(roomMem.objectRuntimeMemories)).toHaveLength(N);

        for (let i = 0; i < N; i++)
        {
            const obj = roomMem.playerObjectMemoryByUserID[users[i].user.id];
            expect(obj).toBeDefined();
            expect(obj.objectSpawnParams.transform.x).toBeCloseTo(5 + i * 4, 0);
            expect(obj.objectSpawnParams.transform.z).toBeCloseTo(5 + i * 3, 0);
            expect(obj.objectSpawnParams.metadata[0]?.str).toBe(`msg-${i}`);
            expect(obj.objectSpawnParams.sourceUserID).toBe(users[i].user.id);
        }
    });

    // ─── Multi-room state independence ──────────────────────────────────────

    it("users in different rooms have independent gameplay states", async () => {
        harness.seedRoom("room-X", "Room X", RoomTypeEnumMap.Regular);
        harness.seedRoom("room-Y", "Room Y", RoomTypeEnumMap.Regular);

        const userX = harness.connectUser({ lastX: 5, lastZ: 5 });
        const userY = harness.connectUser({ lastX: 25, lastZ: 25 });
        await harness.joinRoom(userX, "room-X");
        await harness.joinRoom(userY, "room-Y");

        const stateX = harness.getGameplayState(userX);
        const stateY = harness.getGameplayState(userY);

        expect(stateX!.lastRoomID).toBe("room-X");
        expect(stateY!.lastRoomID).toBe("room-Y");
        expect(stateX!.lastX).toBeCloseTo(5);
        expect(stateY!.lastX).toBeCloseTo(25);

        await harness.disconnectUser(userX, true);
        await harness.disconnectUser(userY, true);

        const savedX = harness.savedGameplayStates.find(s => s.userID === userX.user.id);
        const savedY = harness.savedGameplayStates.find(s => s.userID === userY.user.id);
        expect(savedX!.lastRoomID).toBe("room-X");
        expect(savedY!.lastRoomID).toBe("room-Y");
    });

    // ─── Room switching saves state ─────────────────────────────────────────

    it("switching rooms saves state from previous room", async () => {
        harness.seedRoom("switch-from", "Switch From", RoomTypeEnumMap.Regular);
        harness.seedRoom("switch-to", "Switch To", RoomTypeEnumMap.Regular);

        const ctx = harness.connectUser({ lastX: 10, lastZ: 20 });
        await harness.joinRoom(ctx, "switch-from");

        harness.updateObjectTransform(ctx, new ObjectTransform(15, 0, 25, 0, 0, 1));
        const stateBeforeSwitch = harness.getGameplayState(ctx)!;

        await RoomManager.changeUserRoom(ctx.socketUserContext, "switch-to", true, true);

        expect(harness.savedGameplayStates).toHaveLength(1);
        const saved = harness.savedGameplayStates[0];
        expect(saved.lastRoomID).toBe("switch-from");
        expect(saved.lastX).toBeCloseTo(stateBeforeSwitch.lastX, 0);
        expect(saved.lastZ).toBeCloseTo(stateBeforeSwitch.lastZ, 0);

        expect(RoomManager.currentRoomIDByUserID[ctx.user.id]).toBe("switch-to");
    });

    // ─── Last user leaving unloads room ─────────────────────────────────────

    it("room unloads when last user leaves", async () => {
        harness.seedRoom("unload-test", "Unload Test", RoomTypeEnumMap.Regular);

        const ctx = harness.connectUser();
        await harness.joinRoom(ctx, "unload-test");
        expect(harness.isRoomLoaded("unload-test")).toBe(true);

        await harness.disconnectUser(ctx, false);
        expect(harness.isRoomLoaded("unload-test")).toBe(false);
    });
});
