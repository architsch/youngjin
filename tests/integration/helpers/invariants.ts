/** Invariants that must hold after any valid action sequence (structural, signal, physics, permission). */
import { expect } from "vitest";
import { harness, ConnectedUser } from "./serverHarness";
import { MockSocket } from "./mockSocket";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import SignalTypeConfigMap from "../../../src/shared/networking/maps/signalTypeConfigMap";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";

// ─── Core Structural Invariants ────────────────────────────────────────────

/** Runs the core structural invariants; throws on the first violation. */
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
        const participantCount = Object.keys(roomMem.participantUserNameByID).length;
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
        expect(ServerRoomManager.roomRuntimeMemories[roomID].participantUserNameByID[userID]).toBeDefined();
    }
}

/** Invariant 5: every user-placed object belongs to a room participant. Room-owned objects (no source
 *  user) and single-player rooms are exempt. */
export function checkObjectOwnership(): void
{
    for (const [roomID, roomMem] of Object.entries(ServerRoomManager.roomRuntimeMemories))
    {
        if (roomMem.room.roomType == RoomTypeEnumMap.SinglePlayer)
            continue;
        for (const [objId, obj] of Object.entries(roomMem.room.objectById))
        {
            const sourceUser = obj.sourceUserID;
            if (sourceUser.length == 0)
                continue;
            expect(roomMem.participantUserNameByID[sourceUser]).toBeDefined();
        }
    }
}

/** Invariant 6: No user appears in more than one room. */
export function checkNoUserInMultipleRooms(): void
{
    const seenUsers = new Set<string>();
    for (const roomMem of Object.values(ServerRoomManager.roomRuntimeMemories))
    {
        for (const uid of Object.keys(roomMem.participantUserNameByID))
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
        for (const uid of Object.keys(roomMem.participantUserNameByID))
        {
            const obj = ServerUserManager.getPlayerObject(uid);
            expect(obj, `Player object missing for user ${uid} in room ${roomID}`).toBeDefined();
            expect(obj!.sourceUserID).toBe(uid);
        }
    }
}

/** Invariant 8: every in-room user has a player object and a readable metadata snapshot. */
export function checkObjectTransformConsistency(connectedUsers: ConnectedUser[]): void
{
    for (const ctx of connectedUsers)
    {
        const roomID = ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
        if (!roomID) continue;
        const roomMem = ServerRoomManager.roomRuntimeMemories[roomID];
        if (!roomMem) continue;

        const obj = ServerUserManager.getPlayerObject(ctx.user.id);
        const metadata = ServerUserManager.getPlayerMetadata(ctx.user.id);
        expect(obj).toBeDefined();
        expect(metadata).toBeDefined();
    }
}

// ─── Signal Emission Utilities ─────────────────────────────────────────────

/** Pending signals of a type from a user's SocketUserContext buffer (flushed on the batch interval). */
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

/** All room participants except excludedUserID have the multicast signal; nobody outside the room does. */
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
        const isInRoom = roomMem.participantUserNameByID[ctx.user.id] != undefined;
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

/** A unicast signal reached only the target user. */
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

// ─── Voxel & Physics Invariants ──────────────────────────────────────────

/** Invariant 9: Every room with participants has a loaded physics room. */
export function checkPhysicsRoomConsistency(): void
{
    for (const [roomID, roomMem] of Object.entries(ServerRoomManager.roomRuntimeMemories))
    {
        const participantCount = Object.keys(roomMem.participantUserNameByID).length;
        if (participantCount > 0)
            expect(PhysicsManager.hasRoom(roomID), `Physics room missing for occupied room ${roomID}`).toBe(true);
    }
}

/** Invariant 10: Every participant's player object exists in the physics system. */
export function checkPhysicsObjectConsistency(): void
{
    for (const [roomID, roomMem] of Object.entries(ServerRoomManager.roomRuntimeMemories))
    {
        for (const uid of Object.keys(roomMem.participantUserNameByID))
        {
            const playerObj = ServerUserManager.getPlayerObject(uid);
            if (playerObj)
            {
                const hasPhysObj = PhysicsManager.hasObject(roomID, playerObj.objectId);
                expect(hasPhysObj, `Physics object missing for player ${uid} in room ${roomID}`).toBe(true);
            }
        }
    }
}

/** Invariant 11: a room's owner, while in it, names it as their owned room (both sides of ownership agree). */
export function checkRoomOwnershipConsistency(): void
{
    for (const [roomID, roomMem] of Object.entries(ServerRoomManager.roomRuntimeMemories))
    {
        const ownerID = roomMem.room.ownerUserID;
        if (!ownerID || !roomMem.participantUserNameByID[ownerID])
            continue;

        const ownerContext = ServerUserManager.getSocketUserContext(ownerID);
        if (!ownerContext)
            continue;
        expect(ownerContext.user.ownedRoomID,
            `Owner ${ownerID} of room ${roomID} should name it as his own`).toBe(roomID);
    }
}

// ─── Clean State Invariants ────────────────────────────────────────────────

/** Clean state after all users disconnect. Hubs stay loaded (for balancing) but must be empty. */
export function checkCleanState(): void
{
    expect(Object.keys(ServerUserManager.socketUserContexts)).toHaveLength(0);
    expect(Object.keys(ServerRoomManager.currentRoomIDByUserID)).toHaveLength(0);
    for (const [roomID, roomMem] of Object.entries(ServerRoomManager.roomRuntimeMemories))
    {
        expect(roomMem.room.roomType, `Room ${roomID} should have been unloaded`).toBe(RoomTypeEnumMap.Hub);
        expect(Object.keys(roomMem.participantUserNameByID), `Hub ${roomID} should be empty`).toHaveLength(0);
    }
}

// ─── Composite Invariant Sets ──────────────────────────────────────────────

export type InvariantSet = "structural" | "full" | "extended";

/** Invariant sets: "structural" (1–7), "full" (+8), "extended" (+9–11). */
export function checkInvariants(
    connectedUsers: ConnectedUser[],
    level: InvariantSet = "structural",
): void
{
    checkStructuralInvariants(connectedUsers);
    if (level === "full" || level === "extended")
    {
        checkObjectTransformConsistency(connectedUsers);
    }
    if (level === "extended")
    {
        checkPhysicsRoomConsistency();
        checkPhysicsObjectConsistency();
        checkRoomOwnershipConsistency();
    }
}
