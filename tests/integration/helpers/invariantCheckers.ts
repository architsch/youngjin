/**
 * Shared invariant checking functions for property-based integration tests.
 *
 * These invariants must hold after any valid sequence of server actions:
 *   1. UserManager user count matches tracked array
 *   2. Every user in UserManager has a valid socket context
 *   3. Room participant counts match socket room contexts
 *   4. currentRoomIDByUserID only references loaded rooms
 *   5. Every object in a room belongs to a participant
 *   6. No user appears in more than one room
 *   7. In-room object transforms match getUserGameplayState
 *   8. Every participant has exactly one player object in the room
 */
import { expect } from "vitest";
import { harness, ConnectedUser } from "./serverHarness";
import RoomManager from "../../../src/server/room/roomManager";
import UserManager from "../../../src/server/user/userManager";

/**
 * Runs all structural invariants against the current server state.
 * Throws (via `expect`) on the first violation.
 */
export function checkInvariants(connectedUsers: ConnectedUser[]): void
{
    checkUserManagerCount(connectedUsers);
    checkValidSocketContexts();
    checkRoomParticipantCounts();
    checkRoomIDReferences();
    checkObjectOwnership();
    checkNoUserInMultipleRooms();
    checkPlayerObjectsExist();
}

/** Invariant 1: UserManager user count matches tracked array. */
export function checkUserManagerCount(connectedUsers: ConnectedUser[]): void
{
    const managerUserCount = Object.keys(UserManager.socketUserContexts).length;
    expect(managerUserCount).toBe(connectedUsers.length);
}

/** Invariant 2: Every user in UserManager maps to a valid socket context. */
export function checkValidSocketContexts(): void
{
    for (const uid of Object.keys(UserManager.socketUserContexts))
    {
        const ctx = UserManager.socketUserContexts[uid];
        expect(ctx).toBeDefined();
        expect(ctx.user.id).toBe(uid);
    }
}

/** Invariant 3: For every loaded room, participant count matches socket room context. */
export function checkRoomParticipantCounts(): void
{
    for (const [roomID, roomMem] of Object.entries(RoomManager.roomRuntimeMemories))
    {
        const participantCount = Object.keys(roomMem.participantUserIDs).length;
        const socketRoomCtx = RoomManager.socketRoomContexts[roomID];
        expect(socketRoomCtx).toBeDefined();

        const socketCtxCount = Object.keys(socketRoomCtx!.getUserContexts()).length;
        expect(participantCount).toBe(socketCtxCount);
    }
}

/** Invariant 4: currentRoomIDByUserID only references loaded rooms with the user as participant. */
export function checkRoomIDReferences(): void
{
    for (const [userID, roomID] of Object.entries(RoomManager.currentRoomIDByUserID))
    {
        expect(RoomManager.roomRuntimeMemories[roomID]).toBeDefined();
        expect(RoomManager.roomRuntimeMemories[roomID].participantUserIDs[userID]).toBe(true);
    }
}

/** Invariant 5: Every object in a room belongs to a participant of that room. */
export function checkObjectOwnership(): void
{
    for (const [roomID, roomMem] of Object.entries(RoomManager.roomRuntimeMemories))
    {
        for (const [objId, objMem] of Object.entries(roomMem.objectRuntimeMemories))
        {
            const sourceUser = objMem.objectSpawnParams.sourceUserID;
            expect(roomMem.participantUserIDs[sourceUser]).toBe(true);
        }
    }
}

/** Invariant 6: No user appears in more than one room. */
export function checkNoUserInMultipleRooms(): void
{
    const seenUsers = new Set<string>();
    for (const roomMem of Object.values(RoomManager.roomRuntimeMemories))
    {
        for (const uid of Object.keys(roomMem.participantUserIDs))
        {
            expect(seenUsers.has(uid)).toBe(false);
            seenUsers.add(uid);
        }
    }
}

/** Invariant 8: Every participant in a room has exactly one player object. */
export function checkPlayerObjectsExist(): void
{
    for (const [roomID, roomMem] of Object.entries(RoomManager.roomRuntimeMemories))
    {
        for (const uid of Object.keys(roomMem.participantUserIDs))
        {
            const obj = roomMem.playerObjectMemoryByUserID[uid];
            expect(obj, `Player object missing for user ${uid} in room ${roomID}`).toBeDefined();
            expect(obj.objectSpawnParams.sourceUserID).toBe(uid);
        }
    }
}

/** Invariant 7: In-room object transforms match getUserGameplayState exactly. */
export function checkObjectTransformConsistency(connectedUsers: ConnectedUser[]): void
{
    for (const ctx of connectedUsers)
    {
        const roomID = RoomManager.currentRoomIDByUserID[ctx.user.id];
        if (!roomID) continue;
        const roomMem = RoomManager.roomRuntimeMemories[roomID];
        if (!roomMem) continue;

        const obj = roomMem.playerObjectMemoryByUserID[ctx.user.id];
        const state = harness.getGameplayState(ctx);
        if (obj && state)
        {
            expect(state.lastX).toBe(obj.objectSpawnParams.transform.x);
            expect(state.lastZ).toBe(obj.objectSpawnParams.transform.z);
        }
    }
}
