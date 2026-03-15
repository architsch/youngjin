/**
 * Event: Server restarting / graceful shutdown.
 *
 * Covers criteria items:
 * - Server restarting
 * - Graceful shutdown and rebooting of the server
 * - saveAllUserGameplayStates captures every connected user
 * - After shutdown, rooms can be reloaded with preserved state
 */
import { describe, it, expect, beforeEach } from "vitest";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import RoomManager from "../../../src/server/room/roomManager";
import UserManager from "../../../src/server/user/userManager";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";

const ROOM_ID = "lifecycle-room";

describe("server lifecycle events", () => {
    beforeEach(() => {
        harness.reset();
        harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);
    });

    // ─── saveAllUserGameplayStates ───────────────────────────────────────────

    it("saveAllUserGameplayStates captures every connected user's state", async () => {
        const N = 4;
        const users: ConnectedUser[] = [];

        for (let i = 0; i < N; i++)
        {
            const ctx = harness.connectUser({ lastX: 3 + i * 6, lastZ: 4 + i * 5 });
            await harness.joinRoom(ctx, ROOM_ID);
            users.push(ctx);
        }

        await RoomManager.saveAllUserGameplayStates(UserManager.socketUserContexts);

        expect(harness.savedGameplayStates).toHaveLength(N);

        for (let i = 0; i < N; i++)
        {
            const saved = harness.savedGameplayStates.find(
                s => s.userID === users[i].user.id
            );
            expect(saved).toBeDefined();
            expect(saved!.lastRoomID).toBe(ROOM_ID);
            expect(saved!.lastX).toBeCloseTo(3 + i * 6, 0);
            expect(saved!.lastZ).toBeCloseTo(4 + i * 5, 0);
        }
    });

    // ─── Graceful shutdown ──────────────────────────────────────────────────

    it("graceful shutdown saves all rooms and all user states", async () => {
        harness.seedRoom("room-2", RoomTypeEnumMap.Regular);

        const user1 = harness.connectUser({ id: "shutdown-u1", lastX: 10, lastZ: 12 });
        const user2 = harness.connectUser({ id: "shutdown-u2", lastX: 20, lastZ: 22 });
        await harness.joinRoom(user1, ROOM_ID);
        await harness.joinRoom(user2, "room-2");

        // Move users
        harness.updateObjectTransform(user1, new ObjectTransform(14, 0, 16, 0, 0, 1));
        harness.updateObjectTransform(user2, new ObjectTransform(24, 0, 26, 0, 0, 1));

        const state1Before = harness.getGameplayState(user1)!;
        const state2Before = harness.getGameplayState(user2)!;

        await harness.gracefulShutdown();

        // All states should have been saved
        expect(harness.savedGameplayStates).toHaveLength(2);

        const saved1 = harness.savedGameplayStates.find(s => s.userID === "shutdown-u1");
        const saved2 = harness.savedGameplayStates.find(s => s.userID === "shutdown-u2");
        expect(saved1).toBeDefined();
        expect(saved2).toBeDefined();
        expect(saved1!.lastX).toBeCloseTo(state1Before.lastX, 0);
        expect(saved2!.lastX).toBeCloseTo(state2Before.lastX, 0);

        // All users should be disconnected
        expect(Object.keys(UserManager.socketUserContexts)).toHaveLength(0);
    });

    // ─── Shutdown → Reboot → Reload ─────────────────────────────────────────

    it("after graceful shutdown, rooms can be reloaded with preserved state", async () => {
        const user = harness.connectUser({
            id: "reboot-user", lastX: 16, lastZ: 16,
            playerMetadata: { "0": "pre-shutdown" },
        });
        await harness.joinRoom(user, ROOM_ID);

        // Move and send a message
        harness.updateObjectTransform(user, new ObjectTransform(20, 0, 24, 0, 0, 1));
        harness.sendObjectMessage(user, "save me");

        const stateBeforeShutdown = harness.getGameplayState(user)!;

        // Graceful shutdown
        await harness.gracefulShutdown();

        expect(harness.savedGameplayStates).toHaveLength(1);
        const saved = harness.savedGameplayStates[0];
        expect(saved.lastX).toBeCloseTo(stateBeforeShutdown.lastX, 0);
        expect(saved.lastZ).toBeCloseTo(stateBeforeShutdown.lastZ, 0);
        expect(saved.playerMetadata[String(ObjectMetadataKeyEnumMap.SentMessage)]).toBe("save me");

        // Simulate server reboot: reset state and re-seed rooms
        harness.reset();
        harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);

        // User reconnects with saved state (simulating DB lookup)
        const rebooted = harness.connectUser({
            id: "reboot-user", lastRoomID: saved.lastRoomID,
            lastX: saved.lastX, lastY: saved.lastY, lastZ: saved.lastZ,
            lastDirX: saved.lastDirX, lastDirY: saved.lastDirY, lastDirZ: saved.lastDirZ,
            playerMetadata: saved.playerMetadata,
        });
        await harness.joinRoom(rebooted, ROOM_ID);

        // State should match what was saved before shutdown
        const stateAfterReboot = harness.getGameplayState(rebooted)!;
        expect(stateAfterReboot.lastX).toBeCloseTo(stateBeforeShutdown.lastX, 0);
        expect(stateAfterReboot.lastZ).toBeCloseTo(stateBeforeShutdown.lastZ, 0);

        const obj = harness.getPlayerObjectInRoom(rebooted);
        expect(obj!.getMetadata(ObjectMetadataKeyEnumMap.SentMessage)).toBe("save me");
    });

    // ─── Multiple users across multiple rooms ───────────────────────────────

    it("graceful shutdown handles multiple users across multiple rooms", async () => {
        harness.seedRoom("room-alpha", RoomTypeEnumMap.Regular);
        harness.seedRoom("room-beta", RoomTypeEnumMap.Regular);

        const N = 6;
        const rooms = [ROOM_ID, "room-alpha", "room-beta"];
        const users: ConnectedUser[] = [];

        for (let i = 0; i < N; i++)
        {
            const ctx = harness.connectUser({
                lastX: 8 + i * 3, lastZ: 8 + i * 3,
                playerMetadata: { "0": `user-${i}` },
            });
            await harness.joinRoom(ctx, rooms[i % rooms.length]);
            users.push(ctx);
        }

        await harness.gracefulShutdown();

        expect(harness.savedGameplayStates).toHaveLength(N);
        expect(Object.keys(UserManager.socketUserContexts)).toHaveLength(0);

        for (let i = 0; i < N; i++)
        {
            const saved = harness.savedGameplayStates.find(
                s => s.userID === users[i].user.id
            );
            expect(saved).toBeDefined();
            expect(saved!.lastRoomID).toBe(rooms[i % rooms.length]);
        }
    });
});
