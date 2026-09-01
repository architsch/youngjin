/**
 * Scenario tests: Voxel operations
 *
 * Covers:
 * - Add, remove, move voxel blocks
 * - Set voxel quad texture
 * - Border voxel restrictions
 * - Mixed add/remove sequences
 * - Collision layer operations
 * - Room dirty flag
 * - What now protects a room's way in, which is the door itself rather than any reserved stretch of
 *   the room around it
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_REGULAR, EMPTY_HUB, userAtCenter, buildColumn, removeColumn } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import WallAttachedObjectUtil from "../../../src/shared/object/util/wallAttachedObjectUtil";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import { UserRoleEnumMap } from "../../../src/shared/user/types/userRole";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN,
    FULL_COLLISION_LAYER_MASK, GRAVITY_SPEED,
    MAX_ENCODED_VOXEL_GRID_BYTES, INITIAL_MULTI_PLAYER_ENTRANCE_HEIGHT_IN_LAYERS,
    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
    NUM_COLLISION_LAYERS_PER_STOREY, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, PLAYER_HEIGHT,
    STOREY_FLOOR_COLLISION_LAYER } from "../../../src/shared/system/sharedConstants";
import { RoomVolumeConstructorMap } from "../../../src/shared/room/generation/maps/roomVolumeConstructorMap";
import Room from "../../../src/shared/room/types/room";
import RoomRuntimeMemory from "../../../src/shared/room/types/roomRuntimeMemory";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import Vec3 from "../../../src/shared/math/types/vec3";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import BufferState from "../../../src/shared/networking/types/bufferState";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";

// Raises a stack of blocks in one cell, which the fixtures below use to stand a wall somewhere the
// room did not already have one. No room is passed, so nothing is validated: these are fixtures
// being built rather than a user editing a room.
function fillColumn(voxelGrid: VoxelGrid, row: number, col: number,
    collisionLayerMin: number, collisionLayerMax: number, textures?: number[]): void
{
    for (let layer = collisionLayerMin; layer <= collisionLayerMax; ++layer)
    {
        VoxelUpdateUtil.addVoxelBlock(UserRoleEnumMap.Owner, voxelGrid.voxels,
            VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, layer), textures);
    }
}

describe("voxel scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("adds a voxel block at an interior position", async () => {
        await runScenario({
            name: "add voxel",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [{ type: "addVoxel", userIndex: 0, row: 5, col: 5, layer: 0 }],
            assertions: () => {
                const roomMem = ServerRoomManager.roomRuntimeMemories["hub"];
                const voxel = VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 5, 5)!;
                expect(voxel).toBeDefined();
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 0)).toBe(true);
            },
        });
    });

    it("removes a voxel block", async () => {
        await runScenario({
            name: "remove voxel",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [
                { type: "addVoxel", userIndex: 0, row: 8, col: 8, layer: 0 },
                { type: "removeVoxel", userIndex: 0, row: 8, col: 8, layer: 0 },
            ],
            assertions: () => {
                const roomMem = ServerRoomManager.roomRuntimeMemories["hub"];
                const voxel = VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 8, 8)!;
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 0)).toBe(false);
            },
        });
    });

    it("builds and removes a column of blocks", async () => {
        await runScenario({
            name: "column build/remove",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [
                ...buildColumn(0, 10, 10, 4),
                ...removeColumn(0, 10, 10, 4),
            ],
            assertions: () => {
                const roomMem = ServerRoomManager.roomRuntimeMemories["hub"];
                const voxel = VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 10, 10)!;
                for (let layer = 0; layer < 4; layer++)
                    expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, layer)).toBe(false);
            },
        });
    });

    it("voxel state is consistent after mixed add/remove operations", async () => {
        await runScenario({
            name: "mixed voxel ops",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [
                // Add 4 blocks in a square
                { type: "addVoxel", userIndex: 0, row: 4, col: 4, layer: 0 },
                { type: "addVoxel", userIndex: 0, row: 4, col: 5, layer: 0 },
                { type: "addVoxel", userIndex: 0, row: 5, col: 4, layer: 0 },
                { type: "addVoxel", userIndex: 0, row: 5, col: 5, layer: 0 },
                // Remove diagonal
                { type: "removeVoxel", userIndex: 0, row: 4, col: 4, layer: 0 },
                { type: "removeVoxel", userIndex: 0, row: 5, col: 5, layer: 0 },
            ],
            assertions: () => {
                const roomMem = ServerRoomManager.roomRuntimeMemories["hub"];
                // Removed blocks
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(
                    VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 4, 4)!, 0)).toBe(false);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(
                    VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 5, 5)!, 0)).toBe(false);
                // Remaining blocks
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(
                    VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 4, 5)!, 0)).toBe(true);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(
                    VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 5, 4)!, 0)).toBe(true);
            },
        });
    });

    it("adding a block at multiple collision layers", async () => {
        await runScenario({
            name: "multi-layer blocks",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [
                { type: "addVoxel", userIndex: 0, row: 15, col: 15, layer: 0 },
                { type: "addVoxel", userIndex: 0, row: 15, col: 15, layer: 1 },
                { type: "addVoxel", userIndex: 0, row: 15, col: 15, layer: 3 },
            ],
            assertions: () => {
                const roomMem = ServerRoomManager.roomRuntimeMemories["hub"];
                const voxel = VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 15, 15)!;
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 0)).toBe(true);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 1)).toBe(true);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 2)).toBe(false);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 3)).toBe(true);
            },
        });
    });

    it("removing a non-existent block is handled gracefully", async () => {
        await runScenario({
            name: "remove non-existent",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [
                { type: "removeVoxel", userIndex: 0, row: 10, col: 10, layer: 2 },
            ],
            // Should not crash — the operation just fails silently (with rollback signal)
            assertions: () => {},
        });
    });

    it("duplicate add to occupied layer is rejected", async () => {
        await runScenario({
            name: "duplicate add rejected",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [
                { type: "addVoxel", userIndex: 0, row: 12, col: 12, layer: 0 },
                { type: "addVoxel", userIndex: 0, row: 12, col: 12, layer: 0 }, // duplicate
            ],
            assertions: () => {
                const roomMem = ServerRoomManager.roomRuntimeMemories["hub"];
                const voxel = VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 12, 12)!;
                // Block should still be there (first add succeeded, second was rejected)
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 0)).toBe(true);
            },
        });
    });

    it("refuses to take down a wall a door is hanging on", async () => {
        // Nothing protects the entrance by position any more: the boundary wall around it is
        // ordinary wall, and the floor in front of it is ordinary floor. What protects the way in is
        // the door itself — a block cannot go while something hangs on it, and a door is not a
        // non-admin's to take down first (see DoorObjectTypeConfig).
        await runScenario({
            name: "the wall a door hangs on",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [
                { type: "removeVoxel", userIndex: 0, row: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, col: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL, layer: 0 },
                // The same wall two cells over, which holds nothing up → editable, as a control.
                { type: "removeVoxel", userIndex: 0, row: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, col: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL - 3, layer: 0 },
            ],
            assertions: () => {
                const voxels = ServerRoomManager.roomRuntimeMemories["hub"].room.voxelGrid.voxels;
                const behindDoor = VoxelQueryUtil.getVoxel(voxels,
                    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL)!;
                const plainWall = VoxelQueryUtil.getVoxel(voxels,
                    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL - 3)!;
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(behindDoor, 0),
                    "the wall the room's door hangs on was taken out").toBe(true);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(plainWall, 0)).toBe(false);
            },
        });
    });

    it("builds and hangs freely right up to the entrance, which nothing reserves any more", async () => {
        // The fixed no-build and no-removal zones the entrance used to carry are gone with the hole
        // they were protecting. The floor in front of a door is somewhere to build like anywhere
        // else, and the wall beside one is somewhere to hang a picture like anywhere else.
        await runScenario({
            name: "no entrance zones",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [
                { type: "addVoxel", userIndex: 0, row: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW - 1, col: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL, layer: 0 },
            ],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const inFrontOfDoor = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels,
                    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW - 1, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL)!;
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(inFrontOfDoor, 0)).toBe(true);

                // A picture on the boundary wall beside the door, which the old no-build zone
                // reached over. Clear of the door's own footprint, which is the one thing that still
                // keeps anything off that wall — and keeps it off wherever the door happens to be
                // rather than at one fixed cell.
                const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
                const canHang = WallAttachedObjectUtil.canPlaceObject(room, "attachment",
                    canvasTypeIndex,
                    { x: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL - 3 + 0.5, y: 1, z: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW },
                    { x: 0, y: 0, z: -1 });
                expect(canHang).toBe(true);
            },
        });
    });

    it("a block holding a canvas can only be removed once the canvas goes first", async () => {
        // A two-layer wall, with a canvas hung on the face that looks back towards the room.
        const WALL_ROW = 8;
        const WALL_COL = 8;
        await runScenario({
            name: "canvas on a wall block",
            rooms: [{ ...EMPTY_HUB, voxels: [
                { row: WALL_ROW, col: WALL_COL, layer: 0 },
                { row: WALL_ROW, col: WALL_COL, layer: 1 },
            ] }],
            users: [userAtCenter("hub")],
            assertions: ({ users }) => {
                const user = users[0].user;
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const canvas = new AddObjectSignal(room.id, user.id, user.userName,
                    ObjectTypeConfigMap.getIndexByType("Canvas"), "canvas-on-wall",
                    new ObjectTransform({ x: WALL_COL + 0.5, y: 0.5, z: WALL_ROW }, { x: 0, y: 0, z: -1 }));
                expect(ObjectUpdateUtil.addObject(user, UserRoleEnumMap.Owner, room, canvas)).toBe(true);

                const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(WALL_ROW, WALL_COL, 0);

                // The block is all that keeps the canvas on the wall, so it cannot go by itself...
                expect(WallAttachedObjectUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex))
                    .toEqual([canvas.objectId]);
                expect(VoxelUpdateUtil.canRemoveVoxelBlock(UserRoleEnumMap.Owner, room, quadIndex)).toBe(false);
                // ...but nothing about the block itself stands in the way of taking both down
                // together, which is what the user is offered.
                expect(VoxelUpdateUtil.canRemoveVoxelBlockWithItsWallAttachments(
                    UserRoleEnumMap.Owner, room, quadIndex)).toBe(true);

                // And with the canvas down first, the block is free to follow — the order the
                // menu carries the two removals out in.
                expect(ObjectUpdateUtil.removeObject(user, UserRoleEnumMap.Owner, room,
                    new RemoveObjectSignal(room.id, canvas.objectId))).toBe(true);
                expect(WallAttachedObjectUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex)).toEqual([]);
                expect(VoxelUpdateUtil.canRemoveVoxelBlock(UserRoleEnumMap.Owner, room, quadIndex)).toBe(true);
            },
        });
    });
});

/**
 * The room's boundary, walked into. A room used to have a hole cut through that boundary at its
 * entrance, plugged by an invisible collider so that a player could not walk out through it. Both
 * are gone: the way in is a door hung on the wall, so the wall is simply whole, and what stops a
 * player is the same thing that stops him anywhere else along it.
 */
describe("the room's boundary wall", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    /** Walks a real player collider straight along +Z through the real physics engine. */
    function walkTowardsEntrance(room: Room, startZ: number, standingOnLayer: number): number
    {
        const objectId = "walker";
        const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
        const dir: Vec3 = { x: 0, y: 0, z: 1 };

        if (PhysicsManager.hasRoom(room.id))
            PhysicsManager.unload(room.id);
        PhysicsManager.load(new RoomRuntimeMemory(room, {}));

        // Feet on top of whatever layer he stands on, with the whole of him above it.
        const feetY = (standingOnLayer + 1) * COLLISION_LAYER_HEIGHT;
        let pos: Vec3 = { x: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL + 0.5, y: feetY + 0.5 * PLAYER_HEIGHT,
            z: startZ };
        PhysicsManager.addObject(room.id, objectId, playerTypeIndex,
            PhysicsColliderStateUtil.getObjectColliderState(playerTypeIndex, pos, dir)!);

        const deltaTime = 1 / 60;
        for (let frame = 0; frame < 120; ++frame)
        {
            const desired: Vec3 = { x: 0, y: -GRAVITY_SPEED, z: 3 };
            const adjusted = PhysicsManager.getAdjustedVelocity(room.id, objectId, desired);
            const target: Vec3 = { x: pos.x + adjusted.x * deltaTime, y: pos.y + adjusted.y * deltaTime,
                z: pos.z + adjusted.z * deltaTime };
            pos = PhysicsManager.setObjectTransform(room.id, objectId, target, dir, false).transform.pos;
        }
        PhysicsManager.unload(room.id);
        return pos.z;
    }

    it("stops a player at the entrance the same way it stops him anywhere else", async () => {
        await runScenario({
            name: "walking into the entrance wall",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const startZ = INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW - 2.5;

                // Walking at the entrance cell brings him up against the wall the room's door hangs
                // on and no further, on either storey. There is no gap in the boundary to be held
                // short of any more, and nothing invisible doing the holding.
                const groundZ = walkTowardsEntrance(room, startZ, COLLISION_LAYER_MIN - 1);
                expect(groundZ).toBeLessThan(INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW);

                const upperZ = walkTowardsEntrance(room, startZ, STOREY_FLOOR_COLLISION_LAYER);
                expect(upperZ).toBeLessThan(INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW);
            },
        });
    });
});

/**
 * A room is encoded into one reusable buffer, and writing past the end of a typed array is silently
 * ignored rather than throwing — so a buffer sized by guesswork would turn an unusually full room
 * into a quietly truncated one, saved short and read back missing everything past the cut.
 *
 * The room that tests this is the one nobody has built: every cell of it solid from the room's floor
 * to its ceiling, which is the most a room can ever cost to write down.
 */
describe("the encoded voxel grid", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    function buildRoomFilledSolid(): VoxelGrid
    {
        const voxelGrid = VoxelGrid.createBaseGrid();
        const textures = [1, 2, 3, 4, 5, 6];
        for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
        {
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
                fillColumn(voxelGrid, row, col, COLLISION_LAYER_MIN, COLLISION_LAYER_MAX, textures);
        }
        return voxelGrid;
    }

    it("survives being written and read back when the room is filled solid", () => {
        const voxelGrid = buildRoomFilledSolid();
        for (const voxel of voxelGrid.voxels)
            expect(voxel.collisionLayerMask).toBe(FULL_COLLISION_LAYER_MASK);

        const bufferState = EncodingUtil.startEncoding();
        voxelGrid.encode(bufferState);
        const bytes = new Uint8Array(EncodingUtil.endEncoding(bufferState));

        // Nothing was dropped on the way out...
        expect(bytes.length).toBeLessThanOrEqual(MAX_ENCODED_VOXEL_GRID_BYTES);

        // ...and the room that comes back is the room that went in.
        const reloaded = VoxelGrid.decode(new BufferState(bytes)) as VoxelGrid;
        expect(reloaded.voxels.length).toBe(NUM_VOXEL_ROWS * NUM_VOXEL_COLS);
        expect(reloaded.voxels.map(v => v.collisionLayerMask))
            .toEqual(voxelGrid.voxels.map(v => v.collisionLayerMask));
        expect(Array.from(reloaded.quadsMem.quads)).toEqual(Array.from(voxelGrid.quadsMem.quads));
    });

    it("refuses an encoding that overflowed the buffer rather than handing back a short one", () => {
        // What would otherwise be saved over a real room, or sent to a client as the whole of one.
        const bufferState = EncodingUtil.startEncoding();
        bufferState.byteIndex = bufferState.view.length + 1;
        expect(() => EncodingUtil.endEncoding(bufferState)).toThrow(/overflowed/);

        // And the buffer is left free, so one overflow does not wedge every encoding after it.
        const next = EncodingUtil.startEncoding();
        expect(EncodingUtil.endEncoding(next).byteLength).toBe(0);
    });
});
