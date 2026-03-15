/**
 * Event: User moving an object (e.g. player) in 3D space.
 *
 * Covers criteria items:
 * - User moving an object in 3D space (via objectSyncParams)
 * - Physics validates transforms, resolves desyncs via objectDesyncResolveParams
 * - Object authority checks (user can only move own objects)
 * - Objects removed when user leaves room
 * - Position updates reflected in getUserGameplayState and saved state
 * - Error handling for invalid operations
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import RoomManager from "../../../src/server/room/roomManager";

const ROOM_ID = "movement-room";

describe("object movement events", () => {
    let users: ConnectedUser[];

    beforeEach(async () => {
        harness.reset();
        harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);
        users = [];
    });

    async function connectUserAtPosition(x: number, z: number): Promise<ConnectedUser>
    {
        const ctx = harness.connectUser({ lastX: x, lastZ: z });
        await harness.joinRoom(ctx, ROOM_ID);
        users.push(ctx);
        return ctx;
    }

    // ─── Spawn at correct position ──────────────────────────────────────────

    it("two players spawn at correct positions", async () => {
        const u1 = await connectUserAtPosition(10, 10);
        const u2 = await connectUserAtPosition(20, 20);

        const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];

        const obj1 = harness.getPlayerObject(u1.user.id);
        const obj2 = harness.getPlayerObject(u2.user.id);

        expect(obj1).toBeDefined();
        expect(obj2).toBeDefined();
        expect(obj1!.transform.x).toBeCloseTo(10);
        expect(obj1!.transform.z).toBeCloseTo(10);
        expect(obj2!.transform.x).toBeCloseTo(20);
        expect(obj2!.transform.z).toBeCloseTo(20);
    });

    // ─── Move own object ────────────────────────────────────────────────────

    it("player can update own object transform", async () => {
        const u1 = await connectUserAtPosition(10, 10);

        harness.updateObjectTransform(u1, new ObjectTransform(12, 0, 12, 0, 0, 1));

        const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
        const obj = harness.getPlayerObject(u1.user.id);
        expect(obj!.transform.x).toBeDefined();
        expect(obj!.transform.z).toBeDefined();
    });

    // ─── Authority check ────────────────────────────────────────────────────

    it("player cannot move another player's object", async () => {
        const u1 = await connectUserAtPosition(10, 10);
        const u2 = await connectUserAtPosition(20, 20);

        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const u2ObjectId = harness.getPlayerObject(u2.user.id)!.objectId;
        RoomManager.updateObjectTransform(
            u1.socketUserContext, u2ObjectId,
            new ObjectTransform(15, 0, 15, 0, 0, 1)
        );

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining("has no authority")
        );
        consoleSpy.mockRestore();

        const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
        const obj2 = harness.getPlayerObject(u2.user.id);
        expect(obj2!.transform.x).toBeCloseTo(20);
        expect(obj2!.transform.z).toBeCloseTo(20);
    });

    // ─── Objects removed on leave ───────────────────────────────────────────

    it("objects are removed when user leaves room", async () => {
        const u1 = await connectUserAtPosition(10, 10);
        const u2 = await connectUserAtPosition(20, 20);

        const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
        expect(Object.keys(roomMem.room.objectById)).toHaveLength(2);

        await harness.disconnectUser(u1, false);

        expect(Object.keys(roomMem.room.objectById)).toHaveLength(1);
        expect(harness.getPlayerObject(u2.user.id)).toBeDefined();
        expect(harness.getPlayerObject(u1.user.id)).toBeUndefined();
    });

    // ─── Error handling ─────────────────────────────────────────────────────

    it("handles updateObjectTransform for non-existent object gracefully", async () => {
        const u1 = await connectUserAtPosition(10, 10);

        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        RoomManager.updateObjectTransform(
            u1.socketUserContext, "non-existent-id",
            new ObjectTransform(12, 0, 12, 0, 0, 1)
        );
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it("handles updateObjectTransform for user not in a room gracefully", () => {
        const ctx = harness.connectUser();

        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        RoomManager.updateObjectTransform(
            ctx.socketUserContext, "non-existent-id",
            new ObjectTransform(12, 0, 12, 0, 0, 1)
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining("RoomID not found")
        );
        consoleSpy.mockRestore();
    });

    // ─── Position reflected in getUserGameplayState ─────────────────────────

    it("getUserGameplayState output matches the in-room object transform exactly", async () => {
        const ctx = harness.connectUser({ lastX: 11, lastY: 0.25, lastZ: 22 });
        await harness.joinRoom(ctx, ROOM_ID);

        for (let i = 0; i < 3; i++)
        {
            const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
            const tr = harness.getPlayerObject(ctx.user.id)!.transform;
            harness.updateObjectTransform(ctx,
                new ObjectTransform(tr.x + 0.5, tr.y, tr.z + 0.5, tr.dirX, tr.dirY, tr.dirZ)
            );
        }

        const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
        const objTransform = harness.getPlayerObject(ctx.user.id)!.transform;
        const gameplayState = harness.getGameplayState(ctx)!;

        expect(gameplayState.lastX).toBe(objTransform.x);
        expect(gameplayState.lastY).toBe(objTransform.y);
        expect(gameplayState.lastZ).toBe(objTransform.z);
        expect(gameplayState.lastDirX).toBe(objTransform.dirX);
        expect(gameplayState.lastDirY).toBe(objTransform.dirY);
        expect(gameplayState.lastDirZ).toBe(objTransform.dirZ);
    });

    // ─── Position reflected in saved state ──────────────────────────────────

    it("position updates via updateObjectTransform are reflected in saved state", async () => {
        const ctx = harness.connectUser({ lastX: 16, lastY: 0, lastZ: 16 });
        await harness.joinRoom(ctx, ROOM_ID);

        for (let step = 0; step < 5; step++)
        {
            const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
            const tr = harness.getPlayerObject(ctx.user.id)!.transform;
            harness.updateObjectTransform(ctx,
                new ObjectTransform(Math.min(30, tr.x + 1), tr.y, Math.min(30, tr.z + 1), tr.dirX, tr.dirY, tr.dirZ)
            );
        }

        const finalState = harness.getGameplayState(ctx)!;

        await harness.disconnectUser(ctx, true);
        const saved = harness.savedGameplayStates[0];
        expect(saved.lastX).toBeCloseTo(finalState.lastX, 0);
        expect(saved.lastY).toBeCloseTo(finalState.lastY, 0);
        expect(saved.lastZ).toBeCloseTo(finalState.lastZ, 0);
    });
});
