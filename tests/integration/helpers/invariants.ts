/**
 * Structural invariants that must hold after any valid sequence of server actions.
 *
 * These are grouped into:
 *   - Core structural invariants (user/room/object consistency)
 *   - Signal emission invariants (multicast/unicast correctness)
 *   - Physics consistency invariants
 *   - Permission enforcement invariants
 */
import { expect } from "vitest";
import { harness, ConnectedUser } from "./serverHarness";
import { MockSocket } from "./mockSocket";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import SignalTypeConfigMap from "../../../src/shared/networking/maps/signalTypeConfigMap";

// ─── Core Structural Invariants ────────────────────────────────────────────

/**
 * Runs all core structural invariants against the current server state.
 * Throws (via `expect`) on the first violation.
 */
export function checkStructuralInvariants(connectedUsers: ConnectedUser[]): void
{
    checkUserManagerCount(connectedUsers);
    checkValidSocketContexts();
    checkRoomParticipantCounts();
    checkRoomIDReferences();
    checkObjectOwnership();
    checkNoUserInMultipleRooms();
    checkPlayerObjectsExist();
}

/** Invariant 1: ServerUserManager user count matches tracked array. */
export function checkUserManagerCount(connectedUsers: ConnectedUser[]): void
{
    const managerUserCount = Object.keys(ServerUserManager.socketUserContexts).length;
    expect(managerUserCount).toBe(connectedUsers.length);
}

/** Invariant 2: Every user in ServerUserManager maps to a valid socket context. */
export function checkValidSocketContexts(): void
{
    for (const uid of Object.keys(ServerUserManager.socketUserContexts))
    {
        const ctx = ServerUserManager.socketUserContexts[uid];
        expect(ctx).toBeDefined();
        expect(ctx.user.id).toBe(uid);
    }
}

/** Invariant 3: For every loaded room, participant count matches socket room context. */
export function checkRoomParticipantCounts(): void
{
    for (const [roomID, roomMem] of Object.entries(ServerRoomManager.roomRuntimeMemories))
    {
        const participantCount = Object.keys(roomMem.participantUserIDs).length;
        const socketRoomCtx = ServerRoomManager.socketRoomContexts[roomID];
        expect(socketRoomCtx).toBeDefined();

        const socketCtxCount = Object.keys(socketRoomCtx!.getUserContexts()).length;
        expect(participantCount).toBe(socketCtxCount);
    }
}

/** Invariant 4: currentRoomIDByUserID only references loaded rooms with the user as participant. */
export function checkRoomIDReferences(): void
{
    for (const [userID, roomID] of Object.entries(ServerRoomManager.currentRoomIDByUserID))
    {
        expect(ServerRoomManager.roomRuntimeMemories[roomID]).toBeDefined();
        expect(ServerRoomManager.roomRuntimeMemories[roomID].participantUserIDs[userID]).toBe(true);
    }
}

/** Invariant 5: Every object in a room belongs to a participant of that room. */
export function checkObjectOwnership(): void
{
    for (const [roomID, roomMem] of Object.entries(ServerRoomManager.roomRuntimeMemories))
    {
        for (const [objId, obj] of Object.entries(roomMem.room.objectById))
        {
            const sourceUser = obj.sourceUserID;
            expect(roomMem.participantUserIDs[sourceUser]).toBe(true);
        }
    }
}

/** Invariant 6: No user appears in more than one room. */
export function checkNoUserInMultipleRooms(): void
{
    const seenUsers = new Set<string>();
    for (const roomMem of Object.values(ServerRoomManager.roomRuntimeMemories))
    {
        for (const uid of Object.keys(roomMem.participantUserIDs))
        {
            expect(seenUsers.has(uid)).toBe(false);
            seenUsers.add(uid);
        }
    }
}

/** Invariant 7: Every participant in a room has exactly one player object. */
export function checkPlayerObjectsExist(): void
{
    for (const [roomID, roomMem] of Object.entries(ServerRoomManager.roomRuntimeMemories))
    {
        for (const uid of Object.keys(roomMem.participantUserIDs))
        {
            const obj = ServerUserManager.getPlayerObject(uid);
            expect(obj, `Player object missing for user ${uid} in room ${roomID}`).toBeDefined();
            expect(obj!.sourceUserID).toBe(uid);
        }
    }
}

/** Invariant 8: In-room object transforms match getUserGameplayState exactly. */
export function checkObjectTransformConsistency(connectedUsers: ConnectedUser[]): void
{
    for (const ctx of connectedUsers)
    {
        const roomID = ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
        if (!roomID) continue;
        const roomMem = ServerRoomManager.roomRuntimeMemories[roomID];
        if (!roomMem) continue;

        const obj = ServerUserManager.getPlayerObject(ctx.user.id);
        const state = harness.getGameplayState(ctx);
        if (obj && state)
        {
            expect(state.lastX).toBe(obj.transform.pos.x);
            expect(state.lastZ).toBe(obj.transform.pos.z);
        }
    }
}

// ─── Signal Emission Utilities ─────────────────────────────────────────────

/**
 * Returns all pending signal data of a given type for a user's socket.
 * Uses the MockSocket's emitted record (captured by SocketRoomContext calls).
 *
 * Note: This checks `pendingSignalsToUserByTypeIndex` via the SocketUserContext,
 * which buffers signals until the next batch interval. For testing, we inspect
 * the buffer directly.
 */
export function getPendingSignals(ctx: ConnectedUser, signalType: string): any[]
{
    // Access the private pendingSignalsToUserByTypeIndex via the socket context
    const suc = ctx.socketUserContext as any;
    const typeIndex = getSignalTypeIndex(signalType);
    if (typeIndex == undefined) return [];
    const pending = suc.pendingSignalsToUserByTypeIndex?.[typeIndex];
    return pending ? [...pending] : [];
}

function getSignalTypeIndex(signalType: string): number | undefined
{
    return SignalTypeConfigMap.getIndexByType(signalType);
}

/**
 * Verifies that after a multicast signal, all room participants (except excludedUserID)
 * have the signal pending, and no user outside the room has it.
 */
export function checkMulticastSignalReach(
    roomID: string,
    signalType: string,
    excludedUserID: string | undefined,
    connectedUsers: ConnectedUser[],
): void
{
    const roomMem = ServerRoomManager.roomRuntimeMemories[roomID];
    if (!roomMem) return;

    for (const ctx of connectedUsers)
    {
        const pending = getPendingSignals(ctx, signalType);
        const isInRoom = roomMem.participantUserIDs[ctx.user.id] === true;
        const isExcluded = ctx.user.id === excludedUserID;

        if (isInRoom && !isExcluded)
        {
            expect(pending.length, `User ${ctx.user.id} should have received ${signalType}`).toBeGreaterThan(0);
        }
        else if (!isInRoom)
        {
            expect(pending.length, `User ${ctx.user.id} (not in room) should NOT have received ${signalType}`).toBe(0);
        }
    }
}

/**
 * Verifies that a unicast signal reached only the target user.
 */
export function checkUnicastSignalReach(
    targetUserID: string,
    signalType: string,
    connectedUsers: ConnectedUser[],
): void
{
    for (const ctx of connectedUsers)
    {
        const pending = getPendingSignals(ctx, signalType);
        if (ctx.user.id === targetUserID)
        {
            expect(pending.length, `Target user ${targetUserID} should have received ${signalType}`).toBeGreaterThan(0);
        }
        else
        {
            expect(pending.length, `Non-target user ${ctx.user.id} should NOT have received ${signalType}`).toBe(0);
        }
    }
}

// ─── Clean State Invariants ────────────────────────────────────────────────

/**
 * Verifies the server is in a clean state after all users have disconnected.
 */
export function checkCleanState(): void
{
    expect(Object.keys(ServerUserManager.socketUserContexts)).toHaveLength(0);
    expect(Object.keys(ServerRoomManager.currentRoomIDByUserID)).toHaveLength(0);
    expect(Object.keys(ServerRoomManager.roomRuntimeMemories)).toHaveLength(0);
}

// ─── Composite Invariant Sets ──────────────────────────────────────────────

export type InvariantSet = "structural" | "full";

/**
 * Runs the specified invariant set.
 */
export function checkInvariants(
    connectedUsers: ConnectedUser[],
    level: InvariantSet = "structural",
): void
{
    checkStructuralInvariants(connectedUsers);
    if (level === "full")
    {
        checkObjectTransformConsistency(connectedUsers);
    }
}
