/**
 * Combinations: Concurrent execution of multiple events of the same type.
 *
 * Covers criteria items:
 * - Concurrent same type, same parameters (e.g. two users adding a block to the same position)
 * - Concurrent same type, different parameters (e.g. two users adding blocks to different positions)
 * - N users connecting/disconnecting/joining/editing simultaneously
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { checkPlayerObjectsExist } from "../helpers/invariantCheckers";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import RoomManager from "../../../src/server/room/roomManager";
import { getVoxel, getFirstVoxelQuadIndexInLayer } from "../../../src/shared/voxel/util/voxelQueryUtil";
import { addVoxelBlock } from "../../../src/shared/voxel/util/voxelBlockUpdateUtil";

describe("concurrent same-type events", () => {
    beforeEach(() => {
        harness.reset();
    });

    // ─── Concurrent connections ─────────────────────────────────────────────

    describe("concurrent connections", () => {
        beforeEach(() => {
            harness.seedRoom("hub", "hub");
        });

        it("N users connecting simultaneously", async () => {
            const N = 20;
            const users: ConnectedUser[] = [];

            for (let i = 0; i < N; i++)
                users.push(harness.connectUser());

            expect(Object.keys(harness.UserManager.socketUserContexts)).toHaveLength(N);

            const results = await Promise.all(
                users.map(u => harness.joinRoom(u, "hub"))
            );

            expect(results.every(r => r === true)).toBe(true);
            expect(harness.getRoomParticipantCount("hub")).toBe(N);
        });

        it("mass connect with staggered timing", async () => {
            const N = 30;
            const promises: Promise<boolean>[] = [];

            for (let i = 0; i < N; i++)
            {
                const ctx = harness.connectUser();
                promises.push(harness.joinRoom(ctx, "hub"));
                if (i % 5 === 0)
                    await Promise.resolve(); // yield microtask
            }

            const results = await Promise.all(promises);
            expect(results.every(r => r === true)).toBe(true);
            expect(harness.getRoomParticipantCount("hub")).toBe(N);
        });
    });

    // ─── Concurrent disconnections ──────────────────────────────────────────

    describe("concurrent disconnections", () => {
        it("N users disconnecting simultaneously unloads room", async () => {
            harness.seedRoom("hub", "hub");
            const N = 15;
            const users: ConnectedUser[] = [];

            for (let i = 0; i < N; i++)
            {
                const ctx = harness.connectUser();
                await harness.joinRoom(ctx, "hub");
                users.push(ctx);
            }
            expect(harness.getRoomParticipantCount("hub")).toBe(N);

            await Promise.all(
                users.map(u => harness.disconnectUser(u, false))
            );

            expect(Object.keys(harness.UserManager.socketUserContexts)).toHaveLength(0);
            expect(harness.isRoomLoaded("hub")).toBe(false);
        });

        it("concurrent disconnects with saveState=true save all states", async () => {
            harness.seedRoom("save-room", "Save Room", RoomTypeEnumMap.Regular);
            const N = 8;
            const users: ConnectedUser[] = [];
            const positions: { x: number; z: number }[] = [];

            for (let i = 0; i < N; i++)
            {
                const x = 5 + i * 3;
                const z = 10 + i * 2;
                positions.push({ x, z });
                const ctx = harness.connectUser({
                    lastX: x, lastZ: z,
                    playerMetadata: { "0": `msg-${i}` },
                });
                await harness.joinRoom(ctx, "save-room");
                users.push(ctx);
            }

            await Promise.all(users.map(ctx => harness.disconnectUser(ctx, true)));

            expect(harness.savedGameplayStates).toHaveLength(N);

            for (let i = 0; i < N; i++)
            {
                const saved = harness.savedGameplayStates.find(
                    s => s.userID === users[i].user.id
                );
                expect(saved).toBeDefined();
                expect(saved!.lastRoomID).toBe("save-room");
                expect(saved!.lastX).toBeCloseTo(positions[i].x, 0);
                expect(saved!.lastZ).toBeCloseTo(positions[i].z, 0);
                expect(saved!.playerMetadata["0"]).toBe(`msg-${i}`);
            }
        });

        it("concurrent disconnects after movement save final positions", async () => {
            harness.seedRoom("move-room", "Move Room", RoomTypeEnumMap.Regular);
            const N = 6;
            const users: ConnectedUser[] = [];

            for (let i = 0; i < N; i++)
            {
                const ctx = harness.connectUser({ lastX: 16, lastZ: 16 });
                await harness.joinRoom(ctx, "move-room");
                users.push(ctx);
            }

            for (let i = 0; i < N; i++)
            {
                harness.updateObjectTransform(users[i],
                    new ObjectTransform(5 + i * 4, 0, 5 + i * 3, 0, 0, 1)
                );
            }

            const expectedPositions = users.map(ctx => {
                const state = harness.getGameplayState(ctx)!;
                return { x: state.lastX, z: state.lastZ };
            });

            await Promise.all(users.map(ctx => harness.disconnectUser(ctx, true)));

            expect(harness.savedGameplayStates).toHaveLength(N);

            for (let i = 0; i < N; i++)
            {
                const saved = harness.savedGameplayStates.find(
                    s => s.userID === users[i].user.id
                );
                expect(saved).toBeDefined();
                expect(saved!.lastX).toBeCloseTo(expectedPositions[i].x, 0);
                expect(saved!.lastZ).toBeCloseTo(expectedPositions[i].z, 0);
            }
        });
    });

    // ─── Concurrent room joins ──────────────────────────────────────────────

    describe("concurrent room joins", () => {
        it("N users joining same unloaded room (load dedup via pendingLoads)", async () => {
            harness.seedRoom("room-A", "Room A", RoomTypeEnumMap.Regular);
            expect(harness.isRoomLoaded("room-A")).toBe(false);

            const N = 10;
            const users: ConnectedUser[] = [];
            for (let i = 0; i < N; i++)
                users.push(harness.connectUser());

            const results = await Promise.all(
                users.map(u => harness.joinRoom(u, "room-A"))
            );

            expect(results.every(r => r === true)).toBe(true);
            expect(harness.isRoomLoaded("room-A")).toBe(true);
            expect(harness.getRoomParticipantCount("room-A")).toBe(N);
        });

        it("concurrent join to unloaded room: every user has a player object", async () => {
            harness.seedRoom("obj-vis", "Object Vis", RoomTypeEnumMap.Regular);

            const N = 8;
            const users: ConnectedUser[] = [];
            for (let i = 0; i < N; i++)
                users.push(harness.connectUser({ lastX: 5 + i * 2, lastZ: 10 + i }));

            await Promise.all(users.map(u => harness.joinRoom(u, "obj-vis")));

            // Every participant must have a player object
            checkPlayerObjectsExist();

            // Every participant must be registered in the SocketRoomContext
            const socketRoomCtx = RoomManager.socketRoomContexts["obj-vis"];
            const ctxMap = socketRoomCtx.getUserContexts();
            for (const u of users)
                expect(ctxMap[u.user.id], `SocketRoomContext missing for ${u.user.id}`).toBeDefined();
        });

        it("concurrent join to unloaded room with DB latency: every user has a player object", async () => {
            harness.setLatency(true, 1, 5);
            harness.seedRoom("lat-vis", "Latency Vis", RoomTypeEnumMap.Regular);

            const N = 6;
            const users: ConnectedUser[] = [];
            for (let i = 0; i < N; i++)
                users.push(harness.connectUser({ lastX: 3 + i, lastZ: 3 + i }));

            await Promise.all(users.map(u => harness.joinRoom(u, "lat-vis")));

            checkPlayerObjectsExist();
            expect(harness.getRoomParticipantCount("lat-vis")).toBe(N);

            const roomMem = RoomManager.roomRuntimeMemories["lat-vis"];
            expect(Object.keys(roomMem.objectRuntimeMemories)).toHaveLength(N);
        });

        it("N users joining same loaded room", async () => {
            harness.seedRoom("room-B", "Room B", RoomTypeEnumMap.Regular);

            const first = harness.connectUser();
            await harness.joinRoom(first, "room-B");
            expect(harness.isRoomLoaded("room-B")).toBe(true);

            const N = 15;
            const users: ConnectedUser[] = [];
            for (let i = 0; i < N; i++)
                users.push(harness.connectUser());

            const results = await Promise.all(
                users.map(u => harness.joinRoom(u, "room-B"))
            );

            expect(results.every(r => r === true)).toBe(true);
            expect(harness.getRoomParticipantCount("room-B")).toBe(N + 1);
        });
    });

    // ─── Concurrent voxel edits ─────────────────────────────────────────────

    describe("concurrent voxel edits", () => {
        const VOXEL_ROOM = "voxel-room";

        beforeEach(async () => {
            harness.seedRoom(VOXEL_ROOM, "Voxel Room", RoomTypeEnumMap.Regular);
        });

        it("multiple blocks added at different positions do not conflict", async () => {
            const users: ConnectedUser[] = [];
            for (let i = 0; i < 5; i++)
            {
                const ctx = harness.connectUser();
                await harness.joinRoom(ctx, VOXEL_ROOM);
                users.push(ctx);
            }

            const roomMem = RoomManager.roomRuntimeMemories[VOXEL_ROOM];
            const positions = [[3, 3], [5, 5], [10, 10], [15, 15], [20, 20]];
            const results: boolean[] = [];

            for (const [row, col] of positions)
            {
                const quadIndex = getFirstVoxelQuadIndexInLayer(row, col, 0);
                results.push(addVoxelBlock(roomMem.room, quadIndex, [0, 0, 0, 0]));
            }

            expect(results.every(r => r === true)).toBe(true);

            for (const [row, col] of positions)
            {
                const voxel = getVoxel(roomMem.room, row, col);
                expect(voxel).toBeDefined();
            }
        });

        it("stress test: 10x10 grid of voxel blocks added in rapid sequence", async () => {
            const ctx = harness.connectUser();
            await harness.joinRoom(ctx, VOXEL_ROOM);

            const roomMem = RoomManager.roomRuntimeMemories[VOXEL_ROOM];
            let successCount = 0;

            for (let row = 2; row < 12; row++)
            {
                for (let col = 2; col < 12; col++)
                {
                    const quadIndex = getFirstVoxelQuadIndexInLayer(row, col, 0);
                    if (addVoxelBlock(roomMem.room, quadIndex, [0, 0, 0, 0]))
                        successCount++;
                }
            }

            expect(successCount).toBeGreaterThan(0);
        });
    });

    // ─── Concurrent object transforms ───────────────────────────────────────

    describe("concurrent object transforms", () => {
        it("N users updating transforms concurrently in same room", async () => {
            harness.seedRoom("transform-room", "Transform Room", RoomTypeEnumMap.Regular);

            const N = 8;
            const contexts: ConnectedUser[] = [];

            for (let i = 0; i < N; i++)
            {
                const ctx = harness.connectUser({ lastX: 5 + i * 3, lastZ: 5 + i * 3 });
                await harness.joinRoom(ctx, "transform-room");
                contexts.push(ctx);
            }

            // All players move simultaneously (small movements)
            for (const ctx of contexts)
            {
                const roomMem = RoomManager.roomRuntimeMemories["transform-room"];
                const currentPos = roomMem.playerObjectMemoryByUserID[ctx.user.id].objectSpawnParams.transform;
                harness.updateObjectTransform(ctx,
                    new ObjectTransform(currentPos.x + 0.5, currentPos.y, currentPos.z + 0.5, 0, 0, 1)
                );
            }

            const roomMem = RoomManager.roomRuntimeMemories["transform-room"];
            for (const ctx of contexts)
            {
                const obj = roomMem.playerObjectMemoryByUserID[ctx.user.id];
                expect(obj).toBeDefined();
                expect(obj.objectSpawnParams.transform.x).toBeGreaterThan(0);
                expect(obj.objectSpawnParams.transform.z).toBeGreaterThan(0);
            }
        });
    });
});
