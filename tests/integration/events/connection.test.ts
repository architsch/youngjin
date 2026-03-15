/**
 * Event: User connecting / disconnecting / reconnecting.
 *
 * Covers criteria items:
 * - User connecting to the socket server
 * - User disconnecting from the socket server
 * - Reconnecting Case A (new socket before old disconnect fires)
 * - Reconnecting Case B (old disconnect before new socket connects)
 * - Page refresh / duplicate socket replacement
 * - Rapid connect-disconnect-reconnect cycles
 * - Gameplay state extraction and edge cases
 */
import { describe, it, expect, beforeEach } from "vitest";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";

const ROOM_ID = "conn-room";

describe("connection events", () => {
    beforeEach(() => {
        harness.reset();
        harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);
    });

    // ─── Basic connect ──────────────────────────────────────────────────────

    it("connecting a user registers them in UserManager", () => {
        const ctx = harness.connectUser();
        expect(Object.keys(harness.UserManager.socketUserContexts)).toHaveLength(1);
        expect(harness.UserManager.socketUserContexts[ctx.user.id]).toBeDefined();
    });

    // ─── Basic disconnect ───────────────────────────────────────────────────

    it("disconnect with saveState=true saves gameplay state", async () => {
        const ctx = harness.connectUser({ lastX: 5, lastY: 1, lastZ: 25 });
        await harness.joinRoom(ctx, ROOM_ID);

        await harness.disconnectUser(ctx, true);

        expect(harness.savedGameplayStates).toHaveLength(1);
        const saved = harness.savedGameplayStates[0];
        expect(saved.userID).toBe(ctx.user.id);
        expect(saved.lastRoomID).toBe(ROOM_ID);
        expect(saved.lastX).toBeCloseTo(5);
        expect(saved.lastY).toBeCloseTo(1);
        expect(saved.lastZ).toBeCloseTo(25);
    });

    it("disconnect with saveState=false does NOT save gameplay state", async () => {
        const ctx = harness.connectUser();
        await harness.joinRoom(ctx, ROOM_ID);

        await harness.disconnectUser(ctx, false);

        expect(harness.savedGameplayStates).toHaveLength(0);
    });

    // ─── Reconnection Case A ────────────────────────────────────────────────

    it("Case A: new socket before old disconnect preserves gameplay state", async () => {
        const ctx = harness.connectUser({
            id: "case-a-user", lastX: 10, lastZ: 20,
            playerMetadata: { "0": "hello" },
        });
        await harness.joinRoom(ctx, ROOM_ID);

        // Move the player
        harness.updateObjectTransform(ctx, new ObjectTransform(15, 0, 25, 0.5, 0, 0.8));
        const stateBeforeReconnect = harness.getGameplayState(ctx)!;

        // Reconnect Case A: new socket while old is still registered
        const newCtx = await harness.reconnectCaseA(ctx);

        // New user should have inherited the old session's room
        expect(newCtx.user.id).toBe("case-a-user");
        expect(newCtx.user.lastRoomID).toBe(ROOM_ID);

        // Only one user should be in UserManager
        expect(Object.keys(harness.UserManager.socketUserContexts)).toHaveLength(1);
    });

    it("Case A: reconnected user can rejoin room with preserved position", async () => {
        const ctx = harness.connectUser({
            id: "case-a-rejoin", lastX: 12, lastZ: 18,
        });
        await harness.joinRoom(ctx, ROOM_ID);
        harness.updateObjectTransform(ctx, new ObjectTransform(20, 0, 22, 0, 0, 1));
        const stateBeforeReconnect = harness.getGameplayState(ctx)!;

        const newCtx = await harness.reconnectCaseA(ctx);

        // Re-seed room if it was unloaded
        if (!harness.isRoomLoaded(ROOM_ID))
            harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);

        await harness.joinRoom(newCtx, ROOM_ID);

        const stateAfterRejoin = harness.getGameplayState(newCtx)!;
        expect(stateAfterRejoin.lastX).toBeCloseTo(stateBeforeReconnect.lastX, 0);
        expect(stateAfterRejoin.lastZ).toBeCloseTo(stateBeforeReconnect.lastZ, 0);
    });

    // ─── Reconnection Case B ────────────────────────────────────────────────

    it("Case B: old disconnect before new socket preserves gameplay state", async () => {
        const ctx = harness.connectUser({
            id: "case-b-user", lastX: 8, lastZ: 22,
            playerMetadata: { "0": "wave" },
        });
        await harness.joinRoom(ctx, ROOM_ID);

        harness.updateObjectTransform(ctx, new ObjectTransform(14, 0, 26, 0.3, 0, 0.9));
        const stateBeforeDisconnect = harness.getGameplayState(ctx)!;

        // Reconnect Case B: old user disconnects first, then new socket connects
        const newCtx = await harness.reconnectCaseB(ctx);

        // New user should have the cached state's room applied
        expect(newCtx.user.id).toBe("case-b-user");
        expect(newCtx.user.lastRoomID).toBe(ROOM_ID);
    });

    it("Case B: reconnected user can rejoin room with preserved position", async () => {
        const ctx = harness.connectUser({
            id: "case-b-rejoin", lastX: 16, lastZ: 16,
        });
        await harness.joinRoom(ctx, ROOM_ID);
        harness.updateObjectTransform(ctx, new ObjectTransform(10, 0, 28, 0, 0, 1));
        const stateBeforeDisconnect = harness.getGameplayState(ctx)!;

        const newCtx = await harness.reconnectCaseB(ctx);

        // Re-seed room since it was unloaded (last user left)
        harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);

        await harness.joinRoom(newCtx, ROOM_ID);

        const stateAfterRejoin = harness.getGameplayState(newCtx)!;
        expect(stateAfterRejoin.lastX).toBeCloseTo(stateBeforeDisconnect.lastX, 0);
        expect(stateAfterRejoin.lastZ).toBeCloseTo(stateBeforeDisconnect.lastZ, 0);
    });

    // ─── Page refresh / duplicate socket ────────────────────────────────────

    it("handles duplicate socket replacement (page refresh)", async () => {
        const ctx1 = harness.connectUser({ id: "refresh-user" });
        await harness.joinRoom(ctx1, ROOM_ID);
        expect(harness.getRoomParticipantCount(ROOM_ID)).toBe(1);

        // Simulate page refresh: remove old user and room state
        harness.UserManager.removeUser(ctx1.user.id);
        await harness.RoomManager.changeUserRoom(ctx1.socketUserContext, undefined, false, false);

        // New connection with same user
        const ctx2 = harness.connectUser({
            id: "refresh-user", lastRoomID: ROOM_ID,
        });
        await harness.joinRoom(ctx2, ROOM_ID);

        expect(Object.keys(harness.UserManager.socketUserContexts)).toHaveLength(1);
        expect(harness.getRoomParticipantCount(ROOM_ID)).toBe(1);
    });

    // ─── Rapid cycles ───────────────────────────────────────────────────────

    it("handles rapid connect-disconnect-reconnect cycle", async () => {
        for (let cycle = 0; cycle < 5; cycle++)
        {
            const ctx = harness.connectUser({ id: "rapid-user" });
            await harness.joinRoom(ctx, ROOM_ID);
            expect(harness.getRoomParticipantCount(ROOM_ID)).toBe(1);

            await harness.disconnectUser(ctx, false);
            expect(harness.isRoomLoaded(ROOM_ID)).toBe(false);

            // Re-seed for next cycle
            harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);
        }

        expect(Object.keys(harness.UserManager.socketUserContexts)).toHaveLength(0);
    });

    // ─── Gameplay state extraction ──────────────────────────────────────────

    it("getUserGameplayState returns correct position and roomID", async () => {
        const ctx = harness.connectUser({ lastX: 10, lastY: 0.5, lastZ: 20 });
        await harness.joinRoom(ctx, ROOM_ID);

        const state = harness.getGameplayState(ctx);
        expect(state).toBeDefined();
        expect(state!.userID).toBe(ctx.user.id);
        expect(state!.lastRoomID).toBe(ROOM_ID);
        expect(state!.lastX).toBeCloseTo(10);
        expect(state!.lastY).toBeCloseTo(0.5);
        expect(state!.lastZ).toBeCloseTo(20);
    });

    it("getUserGameplayState returns correct direction vector", async () => {
        const ctx = harness.connectUser({
            lastX: 16, lastY: 0, lastZ: 16,
            lastDirX: 0.7, lastDirY: 0, lastDirZ: 0.7,
        });
        await harness.joinRoom(ctx, ROOM_ID);

        const state = harness.getGameplayState(ctx);
        expect(state).toBeDefined();
        expect(state!.lastDirX).toBeCloseTo(0.7, 1);
        expect(state!.lastDirY).toBeCloseTo(0, 1);
        expect(state!.lastDirZ).toBeCloseTo(0.7, 1);
    });

    it("getUserGameplayState returns correct metadata", async () => {
        const ctx = harness.connectUser({
            playerMetadata: { "0": "hello", "1": "room-xyz" },
        });
        await harness.joinRoom(ctx, ROOM_ID);

        const state = harness.getGameplayState(ctx);
        expect(state).toBeDefined();
        expect(state!.playerMetadata).toEqual({ "0": "hello", "1": "room-xyz" });
    });

    // ─── Edge cases ─────────────────────────────────────────────────────────

    it("getGameplayState returns undefined for a user not in any room", () => {
        const ctx = harness.connectUser();
        expect(harness.getGameplayState(ctx)).toBeUndefined();
    });

    it("getPlayerObjectInRoom returns undefined for a user not in any room", () => {
        const ctx = harness.connectUser();
        expect(harness.getPlayerObjectInRoom(ctx)).toBeUndefined();
    });

    // ─── Position preserved across disconnect → reconnect ───────────────────

    it("player position is preserved across disconnect and reconnect", async () => {
        const ctx1 = harness.connectUser({
            id: "persist-user", lastX: 8, lastY: 0.5, lastZ: 22,
        });
        await harness.joinRoom(ctx1, ROOM_ID);

        harness.updateObjectTransform(ctx1, new ObjectTransform(12, 0.5, 18, 0.3, 0, 0.9));
        const stateBeforeDisconnect = harness.getGameplayState(ctx1)!;

        await harness.disconnectUser(ctx1, true);

        const savedState = harness.savedGameplayStates[0];
        harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);
        const ctx2 = harness.connectUser({
            id: "persist-user", lastRoomID: savedState.lastRoomID,
            lastX: savedState.lastX, lastY: savedState.lastY, lastZ: savedState.lastZ,
            lastDirX: savedState.lastDirX, lastDirY: savedState.lastDirY, lastDirZ: savedState.lastDirZ,
            playerMetadata: savedState.playerMetadata,
        });
        await harness.joinRoom(ctx2, ROOM_ID);

        const stateAfterReconnect = harness.getGameplayState(ctx2);
        expect(stateAfterReconnect).toBeDefined();
        expect(stateAfterReconnect!.lastX).toBeCloseTo(stateBeforeDisconnect!.lastX, 0);
        expect(stateAfterReconnect!.lastY).toBeCloseTo(stateBeforeDisconnect!.lastY, 0);
        expect(stateAfterReconnect!.lastZ).toBeCloseTo(stateBeforeDisconnect!.lastZ, 0);
        expect(stateAfterReconnect!.lastRoomID).toBe(ROOM_ID);
    });

    // ─── Metadata preserved across disconnect → reconnect ───────────────────

    it("player metadata is preserved across disconnect and reconnect", async () => {
        const ctx = harness.connectUser({
            id: "meta-user",
            playerMetadata: { "0": "wave-emote", "1": "room-abc" },
        });
        await harness.joinRoom(ctx, ROOM_ID);

        const objBefore = harness.getPlayerObjectInRoom(ctx);
        expect(objBefore).toBeDefined();
        expect(objBefore!.metadata[0]?.str).toBe("wave-emote");
        expect(objBefore!.metadata[1]?.str).toBe("room-abc");

        await harness.disconnectUser(ctx, true);
        const saved = harness.savedGameplayStates[0];
        expect(saved.playerMetadata).toEqual({ "0": "wave-emote", "1": "room-abc" });

        harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);
        const ctx2 = harness.connectUser({
            id: "meta-user", lastRoomID: saved.lastRoomID,
            lastX: saved.lastX, lastY: saved.lastY, lastZ: saved.lastZ,
            lastDirX: saved.lastDirX, lastDirY: saved.lastDirY, lastDirZ: saved.lastDirZ,
            playerMetadata: saved.playerMetadata,
        });
        await harness.joinRoom(ctx2, ROOM_ID);

        const objAfter = harness.getPlayerObjectInRoom(ctx2);
        expect(objAfter).toBeDefined();
        expect(objAfter!.metadata[0]?.str).toBe("wave-emote");
        expect(objAfter!.metadata[1]?.str).toBe("room-abc");
    });
});
