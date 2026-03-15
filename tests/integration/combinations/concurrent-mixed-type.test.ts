/**
 * Combinations: Concurrent execution of multiple events of different types.
 *
 * Covers criteria items:
 * - Interleaved connects and disconnects
 * - Users switching between multiple rooms
 * - Last-user-leaving race with new user joining
 * - Multiple rooms loading/unloading simultaneously
 * - Join/leave churn (persistence + visibility)
 * - Reconnect while other users are present
 * - Full lifecycle: load → play → disconnect → reload → state restored
 * - Load/unload cycles with state persistence
 * - Mixed returning and new users
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import RoomManager from "../../../src/server/room/roomManager";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";

describe("concurrent mixed-type events", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
        harness.reset();
    });

    // ─── Interleaved connects and disconnects ───────────────────────────────

    it("handles interleaved connects and disconnects", async () => {
        harness.seedRoom("hub");
        const TOTAL = 10;
        const users: ConnectedUser[] = [];

        for (let i = 0; i < TOTAL; i++)
        {
            const ctx = harness.connectUser();
            await harness.joinRoom(ctx, "hub");
            users.push(ctx);
        }

        const disconnects = users.slice(0, TOTAL / 2).map(u => harness.disconnectUser(u, false));
        const newUsers: ConnectedUser[] = [];
        for (let i = 0; i < TOTAL / 2; i++)
        {
            const ctx = harness.connectUser();
            newUsers.push(ctx);
        }
        const connects = newUsers.map(u => harness.joinRoom(u, "hub"));

        await Promise.all([...disconnects, ...connects]);

        expect(Object.keys(harness.UserManager.socketUserContexts)).toHaveLength(TOTAL);
        expect(harness.getRoomParticipantCount("hub")).toBe(TOTAL);
    });

    // ─── Users switching between rooms ──────────────────────────────────────

    it("handles users switching between multiple rooms", async () => {
        harness.seedRoom("room-1", RoomTypeEnumMap.Regular);
        harness.seedRoom("room-2", RoomTypeEnumMap.Regular);
        harness.seedRoom("room-3", RoomTypeEnumMap.Regular);

        const N = 12;
        const users: ConnectedUser[] = [];
        const roomIDs = ["room-1", "room-2", "room-3"];

        for (let i = 0; i < N; i++)
        {
            const ctx = harness.connectUser();
            await harness.joinRoom(ctx, "room-1");
            users.push(ctx);
        }
        expect(harness.getRoomParticipantCount("room-1")).toBe(N);

        for (let i = 0; i < users.length; i++)
        {
            const targetRoom = roomIDs[i % roomIDs.length];
            await harness.RoomManager.changeUserRoom(
                users[i].socketUserContext, targetRoom, true, false
            );
        }

        const perRoom = N / roomIDs.length;
        for (const roomID of roomIDs)
            expect(harness.getRoomParticipantCount(roomID)).toBe(perRoom);
    });

    // ─── Last-user-leaving race ─────────────────────────────────────────────

    it("handles last-user-leaving race with new user joining", async () => {
        harness.seedRoom("room-race", RoomTypeEnumMap.Regular);

        const leaver = harness.connectUser();
        await harness.joinRoom(leaver, "room-race");

        const joiner = harness.connectUser();
        const leavePromise = harness.disconnectUser(leaver, false);
        const joinPromise = harness.joinRoom(joiner, "room-race");

        await Promise.all([leavePromise, joinPromise]);

        expect(harness.isRoomLoaded("room-race")).toBe(true);
        expect(harness.getRoomParticipantCount("room-race")).toBe(1);
    });

    // ─── Multiple rooms loading/unloading ───────────────────────────────────

    it("handles multiple rooms loading simultaneously", async () => {
        const ROOM_COUNT = 8;
        for (let i = 0; i < ROOM_COUNT; i++)
            harness.seedRoom(`multi-${i}`, RoomTypeEnumMap.Regular);

        const users: ConnectedUser[] = [];
        for (let i = 0; i < ROOM_COUNT; i++)
            users.push(harness.connectUser());

        const results = await Promise.all(
            users.map((u, i) => harness.joinRoom(u, `multi-${i}`))
        );

        expect(results.every(r => r === true)).toBe(true);
        for (let i = 0; i < ROOM_COUNT; i++)
        {
            expect(harness.isRoomLoaded(`multi-${i}`)).toBe(true);
            expect(harness.getRoomParticipantCount(`multi-${i}`)).toBe(1);
        }
    });

    it("handles multiple rooms unloading simultaneously", async () => {
        const ROOM_COUNT = 5;
        const users: ConnectedUser[] = [];

        for (let i = 0; i < ROOM_COUNT; i++)
        {
            harness.seedRoom(`unload-${i}`, RoomTypeEnumMap.Regular);
            const ctx = harness.connectUser();
            await harness.joinRoom(ctx, `unload-${i}`);
            users.push(ctx);
        }

        for (let i = 0; i < ROOM_COUNT; i++)
            expect(harness.isRoomLoaded(`unload-${i}`)).toBe(true);

        await Promise.all(
            users.map(u => harness.disconnectUser(u, false))
        );

        for (let i = 0; i < ROOM_COUNT; i++)
            expect(harness.isRoomLoaded(`unload-${i}`)).toBe(false);
    });

    // ─── Join/leave churn ───────────────────────────────────────────────────

    it("users leaving while others join — persistence and visibility correct", async () => {
        const ROOM_ID = "churn-room";
        harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);

        const stayers: ConnectedUser[] = [];
        const leavers: ConnectedUser[] = [];

        for (let i = 0; i < 3; i++)
        {
            const ctx = harness.connectUser({
                lastX: 5 + i * 6, lastZ: 5 + i * 4,
                playerMetadata: { "0": `stayer-${i}` },
            });
            await harness.joinRoom(ctx, ROOM_ID);
            stayers.push(ctx);
        }
        for (let i = 0; i < 3; i++)
        {
            const ctx = harness.connectUser({
                lastX: 25 - i * 3, lastZ: 20 - i * 2,
                playerMetadata: { "0": `leaver-${i}` },
            });
            await harness.joinRoom(ctx, ROOM_ID);
            leavers.push(ctx);
        }

        // Move leavers to unique positions
        const leaverStatesBeforeLeave: Array<{ x: number; z: number }> = [];
        for (let i = 0; i < leavers.length; i++)
        {
            harness.updateObjectTransform(leavers[i],
                new ObjectTransform(28 - i * 2, 0, 28 - i * 2, 0, 0, 1)
            );
            const actual = harness.getGameplayState(leavers[i])!;
            leaverStatesBeforeLeave.push({ x: actual.lastX, z: actual.lastZ });
        }

        // Joiners arrive while leavers depart
        const joiners: ConnectedUser[] = [];
        for (let i = 0; i < 3; i++)
        {
            joiners.push(harness.connectUser({
                lastX: 10 + i * 2, lastZ: 10 + i * 2,
                playerMetadata: { "0": `joiner-${i}` },
            }));
        }

        const leavePromises = leavers.map(ctx => harness.disconnectUser(ctx, true));
        const joinPromises = joiners.map(ctx => harness.joinRoom(ctx, ROOM_ID));
        await Promise.all([...leavePromises, ...joinPromises]);

        // Leavers' states saved
        expect(harness.savedGameplayStates).toHaveLength(3);
        for (let i = 0; i < leavers.length; i++)
        {
            const saved = harness.savedGameplayStates.find(
                s => s.userID === leavers[i].user.id
            );
            expect(saved).toBeDefined();
            expect(saved!.lastX).toBeCloseTo(leaverStatesBeforeLeave[i].x, 0);
            expect(saved!.lastZ).toBeCloseTo(leaverStatesBeforeLeave[i].z, 0);
        }

        // Stayers and joiners remain
        const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
        expect(Object.keys(roomMem.participantUserIDs)).toHaveLength(6);

        for (let i = 0; i < stayers.length; i++)
        {
            const obj = harness.getPlayerObject(stayers[i].user.id);
            expect(obj).toBeDefined();
            expect(obj!.metadata[0]?.str).toBe(`stayer-${i}`);
        }
        for (let i = 0; i < joiners.length; i++)
        {
            const obj = harness.getPlayerObject(joiners[i].user.id);
            expect(obj).toBeDefined();
            expect(obj!.metadata[0]?.str).toBe(`joiner-${i}`);
        }
        for (const ctx of leavers)
            expect(harness.getPlayerObject(ctx.user.id)).toBeUndefined();
    });

    // ─── Reconnect while others present ─────────────────────────────────────

    it("reconnecting user's restored state is visible to observers", async () => {
        const ROOM_ID = "recon-room";
        harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);

        const userA = harness.connectUser({
            id: "user-A-recon", lastX: 8, lastZ: 20,
            playerMetadata: { "0": "wave" },
        });
        const userB = harness.connectUser({ id: "user-B-observer" });
        await harness.joinRoom(userA, ROOM_ID);
        await harness.joinRoom(userB, ROOM_ID);

        harness.updateObjectTransform(userA, new ObjectTransform(14, 0, 25, 0.5, 0, 0.8));
        const stateBeforeDisconnect = harness.getGameplayState(userA)!;

        await harness.disconnectUser(userA, true);
        expect(harness.isRoomLoaded(ROOM_ID)).toBe(true);

        const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
        expect(harness.getPlayerObject("user-A-recon")).toBeUndefined();
        expect(harness.getPlayerObject("user-B-observer")).toBeDefined();

        const saved = harness.savedGameplayStates[0];
        const reconnectedA = harness.connectUser({
            id: "user-A-recon", lastRoomID: saved.lastRoomID,
            lastX: saved.lastX, lastY: saved.lastY, lastZ: saved.lastZ,
            lastDirX: saved.lastDirX, lastDirY: saved.lastDirY, lastDirZ: saved.lastDirZ,
            playerMetadata: saved.playerMetadata,
        });
        await harness.joinRoom(reconnectedA, ROOM_ID);

        const objA = harness.getPlayerObject("user-A-recon");
        expect(objA).toBeDefined();
        expect(objA!.transform.x).toBeCloseTo(stateBeforeDisconnect.lastX, 0);
        expect(objA!.transform.z).toBeCloseTo(stateBeforeDisconnect.lastZ, 0);

        expect(Object.keys(roomMem.participantUserIDs)).toHaveLength(2);
    });

    it("multiple users reconnecting to unloaded room concurrently", async () => {
        const ROOM_ID = "multi-recon-room";
        harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);

        const N = 4;
        const originalUsers: ConnectedUser[] = [];

        for (let i = 0; i < N; i++)
        {
            const ctx = harness.connectUser({
                id: `recon-user-${i}`, lastX: 16, lastZ: 16,
            });
            await harness.joinRoom(ctx, ROOM_ID);
            harness.updateObjectTransform(ctx,
                new ObjectTransform(5 + i * 5, 0, 10 + i * 4, 0, 0, 1)
            );
            originalUsers.push(ctx);
        }

        for (const ctx of originalUsers)
            await harness.disconnectUser(ctx, true);
        expect(harness.isRoomLoaded(ROOM_ID)).toBe(false);

        harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);
        const reconnectedUsers: ConnectedUser[] = [];
        for (let i = 0; i < N; i++)
        {
            const saved = harness.savedGameplayStates.find(
                s => s.userID === `recon-user-${i}`
            )!;
            reconnectedUsers.push(harness.connectUser({
                id: `recon-user-${i}`, lastRoomID: saved.lastRoomID,
                lastX: saved.lastX, lastY: saved.lastY, lastZ: saved.lastZ,
                lastDirX: saved.lastDirX, lastDirY: saved.lastDirY, lastDirZ: saved.lastDirZ,
                playerMetadata: saved.playerMetadata,
            }));
        }

        const results = await Promise.all(
            reconnectedUsers.map(ctx => harness.joinRoom(ctx, ROOM_ID))
        );
        expect(results.every(r => r === true)).toBe(true);

        const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
        expect(Object.keys(roomMem.room.objectById)).toHaveLength(N);

        for (let i = 0; i < N; i++)
        {
            const saved = harness.savedGameplayStates.find(
                s => s.userID === `recon-user-${i}`
            )!;
            const obj = harness.getPlayerObject(`recon-user-${i}`);
            expect(obj).toBeDefined();
            expect(obj!.transform.x).toBeCloseTo(saved.lastX, 0);
            expect(obj!.transform.z).toBeCloseTo(saved.lastZ, 0);
        }
    });

    // ─── Full lifecycle ─────────────────────────────────────────────────────

    it("full lifecycle: load → play → disconnect → reload → state restored", async () => {
        const ROOM_ID = "lifecycle-room";
        harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);
        expect(harness.isRoomLoaded(ROOM_ID)).toBe(false);

        const userA = harness.connectUser({
            id: "lifecycle-A", lastX: 8, lastZ: 12,
            playerMetadata: { "0": "hey" },
        });
        await harness.joinRoom(userA, ROOM_ID);

        const userB = harness.connectUser({
            id: "lifecycle-B", lastX: 20, lastZ: 24,
            playerMetadata: { "0": "yo" },
        });
        await harness.joinRoom(userB, ROOM_ID);

        harness.updateObjectTransform(userA, new ObjectTransform(15, 0, 18, 0, 0, 1));
        harness.sendObjectMessage(userA, "see ya");
        const stateAfterMove = harness.getGameplayState(userA)!;

        await harness.disconnectUser(userA, true);
        const savedA = harness.savedGameplayStates[0];
        expect(savedA.lastX).toBeCloseTo(stateAfterMove.lastX, 0);
        expect(savedA.playerMetadata[String(ObjectMetadataKeyEnumMap.SentMessage)]).toBe("see ya");

        await harness.disconnectUser(userB, true);
        expect(harness.isRoomLoaded(ROOM_ID)).toBe(false);

        harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);

        const reconnectedA = harness.connectUser({
            id: "lifecycle-A", lastRoomID: savedA.lastRoomID,
            lastX: savedA.lastX, lastY: savedA.lastY, lastZ: savedA.lastZ,
            lastDirX: savedA.lastDirX, lastDirY: savedA.lastDirY, lastDirZ: savedA.lastDirZ,
            playerMetadata: savedA.playerMetadata,
        });
        await harness.joinRoom(reconnectedA, ROOM_ID);

        const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
        const objA = harness.getPlayerObject("lifecycle-A");
        expect(objA).toBeDefined();
        expect(objA!.transform.x).toBeCloseTo(savedA.lastX, 0);
        expect(objA!.metadata[ObjectMetadataKeyEnumMap.SentMessage]?.str).toBe("see ya");
    });

    // ─── Load/unload cycles ─────────────────────────────────────────────────

    it("state persists across multiple room load/unload cycles", async () => {
        const ROOM_ID = "cycle-room";
        harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);

        const CYCLES = 3;
        let lastSavedX = 16;
        let lastSavedZ = 16;

        for (let cycle = 0; cycle < CYCLES; cycle++)
        {
            if (!harness.isRoomLoaded(ROOM_ID))
                harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);

            const ctx = harness.connectUser({
                id: "cycle-user", lastRoomID: ROOM_ID,
                lastX: lastSavedX, lastY: 0, lastZ: lastSavedZ,
            });
            await harness.joinRoom(ctx, ROOM_ID);

            const state = harness.getGameplayState(ctx)!;
            expect(state.lastX).toBeCloseTo(lastSavedX, 0);
            expect(state.lastZ).toBeCloseTo(lastSavedZ, 0);

            const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
            const tr = harness.getPlayerObject(ctx.user.id)!.transform;
            harness.updateObjectTransform(ctx,
                new ObjectTransform(
                    Math.min(30, tr.x + 1), tr.y, Math.min(30, tr.z + 1),
                    tr.dirX, tr.dirY, tr.dirZ
                )
            );

            await harness.disconnectUser(ctx, true);

            const saved = harness.savedGameplayStates[harness.savedGameplayStates.length - 1];
            lastSavedX = saved.lastX;
            lastSavedZ = saved.lastZ;
        }

        expect(lastSavedX).toBeGreaterThanOrEqual(16);
        expect(lastSavedZ).toBeGreaterThanOrEqual(16);
        expect(harness.savedGameplayStates).toHaveLength(CYCLES);
    });

    // ─── Mixed returning and new users ──────────────────────────────────────

    it("mix of returning users (with saved state) and new users in same room", async () => {
        const ROOM_ID = "mixed-room";
        harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);

        const returningA = harness.connectUser({
            id: "returning-A", lastX: 12, lastZ: 18,
            playerMetadata: { "0": "welcome-back" },
        });
        await harness.joinRoom(returningA, ROOM_ID);
        harness.updateObjectTransform(returningA, new ObjectTransform(20, 0, 25, 0, 0, 1));
        const actualStateAfterMove = harness.getGameplayState(returningA)!;
        await harness.disconnectUser(returningA, true);

        harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);

        const savedA = harness.savedGameplayStates.find(s => s.userID === "returning-A")!;
        const reconnectedA = harness.connectUser({
            id: "returning-A", lastRoomID: savedA.lastRoomID,
            lastX: savedA.lastX, lastY: savedA.lastY, lastZ: savedA.lastZ,
            lastDirX: savedA.lastDirX, lastDirY: savedA.lastDirY, lastDirZ: savedA.lastDirZ,
            playerMetadata: savedA.playerMetadata,
        });
        const newUser = harness.connectUser({
            id: "brand-new", lastX: 16, lastZ: 16,
        });

        const [resultA, resultNew] = await Promise.all([
            harness.joinRoom(reconnectedA, ROOM_ID),
            harness.joinRoom(newUser, ROOM_ID),
        ]);
        expect(resultA).toBe(true);
        expect(resultNew).toBe(true);

        const roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
        const objA = harness.getPlayerObject("returning-A");
        expect(objA!.transform.x).toBeCloseTo(actualStateAfterMove.lastX, 0);

        const objNew = harness.getPlayerObject("brand-new");
        expect(objNew!.transform.x).toBeCloseTo(16, 0);

        expect(Object.keys(roomMem.room.objectById)).toHaveLength(2);
    });

    // ─── Interleaved join/leave on fresh room ───────────────────────────────

    it("interleaved join/leave on a fresh room: state consistent through full lifecycle", async () => {
        const ROOM_ID = "interleave-room";
        harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Regular);
        expect(harness.isRoomLoaded(ROOM_ID)).toBe(false);

        const userA = harness.connectUser({
            id: "interleave-A", lastX: 10, lastZ: 10,
            playerMetadata: { "0": "first" },
        });
        await harness.joinRoom(userA, ROOM_ID);

        harness.updateObjectTransform(userA, new ObjectTransform(18, 0, 22, 0, 0, 1));
        const stateAfterAMove = harness.getGameplayState(userA)!;

        const userB = harness.connectUser({
            id: "interleave-B", lastX: 5, lastZ: 5,
            playerMetadata: { "0": "second" },
        });
        await harness.joinRoom(userB, ROOM_ID);

        let roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
        expect(harness.getPlayerObject("interleave-A")!.transform.x)
            .toBeCloseTo(stateAfterAMove.lastX, 0);

        await harness.disconnectUser(userA, true);
        expect(harness.isRoomLoaded(ROOM_ID)).toBe(true);

        const userC = harness.connectUser({
            id: "interleave-C", lastX: 22, lastZ: 22,
            playerMetadata: { "0": "third" },
        });
        await harness.joinRoom(userC, ROOM_ID);

        roomMem = RoomManager.roomRuntimeMemories[ROOM_ID];
        expect(Object.keys(roomMem.room.objectById)).toHaveLength(2);
        expect(harness.getPlayerObject("interleave-B")).toBeDefined();
        expect(harness.getPlayerObject("interleave-C")).toBeDefined();
        expect(harness.getPlayerObject("interleave-A")).toBeUndefined();

        await harness.disconnectUser(userB, true);
        await harness.disconnectUser(userC, true);
        expect(harness.isRoomLoaded(ROOM_ID)).toBe(false);

        expect(harness.savedGameplayStates).toHaveLength(3);

        const savedA = harness.savedGameplayStates.find(s => s.userID === "interleave-A")!;
        expect(savedA.lastX).toBeCloseTo(stateAfterAMove.lastX, 0);

        const savedB = harness.savedGameplayStates.find(s => s.userID === "interleave-B")!;
        expect(savedB.lastX).toBeCloseTo(5, 0);

        const savedC = harness.savedGameplayStates.find(s => s.userID === "interleave-C")!;
        expect(savedC.lastX).toBeCloseTo(22, 0);
    });
});
