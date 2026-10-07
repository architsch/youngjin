/**
 * Scenario tests: voxel operations — add, remove, move, texture, border restrictions, mixed sequences,
 * collision layers, the dirty flag, and entrance protection (the door itself, not a reserved area).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_REGULAR, EMPTY_HUB, userAtCenter, usersInRoom, buildColumn, removeColumn } from "../helpers/scenarioPresets";
import { getPendingSignals } from "../helpers/invariants";
import { ConnectedUser } from "../helpers/serverHarness";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerVoxelManager from "../../../src/server/voxel/serverVoxelManager";
import SetVoxelBlockShapeSignal from "../../../src/shared/voxel/types/update/setVoxelBlockShapeSignal";
import MoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/moveVoxelBlockSignal";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import ObjectAttachmentUtil from "../../../src/shared/object/util/objectAttachmentUtil";
import ObjectScaleUtil from "../../../src/shared/object/util/objectScaleUtil";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN,
    GRAVITY_SPEED,
    MAX_ENCODED_VOXEL_GRID_BYTES, INITIAL_MULTI_PLAYER_ENTRANCE_HEIGHT_IN_LAYERS,
    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
    NUM_COLLISION_LAYERS, NUM_COLLISION_LAYERS_PER_STOREY, NUM_VOXEL_COLS, NUM_VOXEL_ROWS,
    STOREY_FLOOR_COLLISION_LAYER, UNIT_VEC3, VOXEL_BLOCK_SHAPE_EMPTY,
    VOXEL_BLOCK_SHAPE_WHOLE } from "../../../src/shared/system/sharedConstants";
import { PLAYER_HEIGHT } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import { RoomVolumeConstructorMap } from "../../../src/shared/room/generation/maps/roomVolumeConstructorMap";
import Room from "../../../src/shared/room/types/room";
import RoomRuntimeMemory from "../../../src/shared/room/types/roomRuntimeMemory";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import Vec3 from "../../../src/shared/math/types/vec3";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import BufferState from "../../../src/shared/networking/types/bufferState";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import { createEditingUser } from "../helpers/mockUser";

// The acting user (editing utilities require one).
const actingUser = createEditingUser();

// Stacks blocks in a cell without validation (fixture building, not a user edit).
function fillColumn(voxelGrid: VoxelGrid, row: number, col: number,
    collisionLayerMin: number, collisionLayerMax: number, textures?: number[]): void
{
    for (let layer = collisionLayerMin; layer <= collisionLayerMax; ++layer)
    {
        VoxelUpdateUtil.addVoxelBlock(undefined, voxelGrid.voxels,
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
                expect(VoxelQueryUtil.isVoxelBlockPresent(voxel, 0)).toBe(true);
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
                expect(VoxelQueryUtil.isVoxelBlockPresent(voxel, 0)).toBe(false);
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
                    expect(VoxelQueryUtil.isVoxelBlockPresent(voxel, layer)).toBe(false);
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
                expect(VoxelQueryUtil.isVoxelBlockPresent(
                    VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 4, 4)!, 0)).toBe(false);
                expect(VoxelQueryUtil.isVoxelBlockPresent(
                    VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 5, 5)!, 0)).toBe(false);
                // Remaining blocks
                expect(VoxelQueryUtil.isVoxelBlockPresent(
                    VoxelQueryUtil.getVoxel(roomMem.room.voxelGrid.voxels, 4, 5)!, 0)).toBe(true);
                expect(VoxelQueryUtil.isVoxelBlockPresent(
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
                expect(VoxelQueryUtil.isVoxelBlockPresent(voxel, 0)).toBe(true);
                expect(VoxelQueryUtil.isVoxelBlockPresent(voxel, 1)).toBe(true);
                expect(VoxelQueryUtil.isVoxelBlockPresent(voxel, 2)).toBe(false);
                expect(VoxelQueryUtil.isVoxelBlockPresent(voxel, 3)).toBe(true);
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
                expect(VoxelQueryUtil.isVoxelBlockPresent(voxel, 0)).toBe(true);
            },
        });
    });

    it("refuses to take down a wall a door is hanging on", async () => {
        // The entrance has no positional protection: a block can't be removed while something hangs on it,
        // and non-admins can't remove the door (see DoorObjectTypeConfig).
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
                expect(VoxelQueryUtil.isVoxelBlockPresent(behindDoor, 0),
                    "the wall the room's door hangs on was taken out").toBe(true);
                expect(VoxelQueryUtil.isVoxelBlockPresent(plainWall, 0)).toBe(false);
            },
        });
    });

    it("builds and hangs freely right up to the entrance, which nothing reserves any more", async () => {
        // The floor before a door and the wall beside it are ordinary space to build and hang on.
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
                expect(VoxelQueryUtil.isVoxelBlockPresent(inFrontOfDoor, 0)).toBe(true);

                // A picture beside the door, clear of the door's footprint (the only thing keeping it off that wall).
                const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
                const canHang = ObjectAttachmentUtil.canPlaceObject(room, "attachment",
                    canvasTypeIndex, new ObjectTransform(
                        { x: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL - 3 + 0.5, y: 1, z: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW },
                        { x: 0, y: 0, z: -1 }, {...UNIT_VEC3}));
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
                    new ObjectTransform({ x: WALL_COL + 0.5, y: 0.5, z: WALL_ROW }, { x: 0, y: 0, z: -1 },
                        {...UNIT_VEC3}));
                expect(ObjectUpdateUtil.addObject(user, room, canvas)).toBe(true);

                const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(WALL_ROW, WALL_COL, 0);

                // The block is all that keeps the canvas on the wall, so it cannot go by itself...
                expect(ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex))
                    .toEqual([canvas.objectId]);
                expect(VoxelUpdateUtil.canRemoveVoxelBlock(actingUser, room, quadIndex)).toBe(false);
                // ...but the block and its attachments may be removed together, as the user is offered.
                expect(VoxelUpdateUtil.canRemoveVoxelBlockWithItsAttachments(
                    actingUser, room, quadIndex)).toBe(true);

                // With the canvas down first, the block may follow (the menu's removal order).
                expect(ObjectUpdateUtil.removeObject(user, room,
                    new RemoveObjectSignal(room.id, canvas.objectId))).toBe(true);
                expect(ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex)).toEqual([]);
                expect(VoxelUpdateUtil.canRemoveVoxelBlock(actingUser, room, quadIndex)).toBe(true);
            },
        });
    });

    it("a block holds the lamps standing on it and hanging under it, and only those", async () => {
        // One block up in the air: a lamp on its top, one under it, and one on the room floor beneath.
        const ROW = 8;
        const COL = 8;
        const LAYER = 4;
        await runScenario({
            name: "lamps on a floating block",
            rooms: [{ ...EMPTY_HUB, voxels: [{ row: ROW, col: COL, layer: LAYER }] }],
            users: [userAtCenter("hub")],
            assertions: ({ users }) => {
                const user = users[0].user;
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
                const lamp = (objectId: string, y: number, dirY: number) => new AddObjectSignal(room.id,
                    user.id, user.userName, lampTypeIndex, objectId, new ObjectTransform(
                        { x: COL + 0.5, y, z: ROW + 0.5 }, { x: 0, y: dirY, z: 0 }, {...UNIT_VEC3}));

                const onTop = lamp("on-top", (LAYER + 1) * COLLISION_LAYER_HEIGHT, 1);
                const underneath = lamp("underneath", LAYER * COLLISION_LAYER_HEIGHT, -1);
                const onFloor = lamp("on-floor", 0, 1);
                for (const attached of [onTop, underneath, onFloor])
                    expect(ObjectUpdateUtil.addObject(user, room, attached), attached.objectId).toBe(true);

                const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(ROW, COL, LAYER);
                expect(ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex).sort())
                    .toEqual([onTop.objectId, underneath.objectId].sort());
                expect(VoxelUpdateUtil.canRemoveVoxelBlock(actingUser, room, quadIndex)).toBe(false);
            },
        });
    });
});

/**
 * Blocks of other shapes than whole (see VoxelBlockShapeUtil), as the server takes them: put up, reshaped
 * and moved, each told to the others in the room, and each refusal answered to its sender with what the
 * cell layers it touched really hold.
 */
describe("shrunk blocks", () => {
    const LOW_X_HALF = 0b0101;
    const LOW_Z_HALF = 0b0011;
    const HIGH_Z_HALF = 0b1100;
    const QUARTER = 0b0001;
    const DIAGONAL = 0b0110;
    const TEXTURES: [number, number, number, number, number, number] = [1, 2, 3, 4, 5, 6];
    const ROW = 10;
    const COL = 10;

    const quadIndexAt = (row: number, col: number, layer: number = 0) =>
        VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, layer);
    const shapeAt = (row: number, col: number, layer: number = 0) => VoxelQueryUtil.getVoxelBlockShapeAt(
        ServerRoomManager.roomRuntimeMemories["hub"].room.voxelGrid.voxels, row, col, layer);

    // What a user has been sent about blocks, in the terms of the three signals that say it.
    function blockSignalsSentTo(user: ConnectedUser): {[signalType: string]: any[]}
    {
        return {
            add: getPendingSignals(user, "addVoxelBlockSignal"),
            remove: getPendingSignals(user, "removeVoxelBlockSignal"),
            move: getPendingSignals(user, "moveVoxelBlockSignal"),
            reshape: getPendingSignals(user, "setVoxelBlockShapeSignal"),
        };
    }

    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("puts up a block of the shape asked for, and tells the others", async () => {
        await runScenario({
            name: "add a shrunk block",
            rooms: [EMPTY_HUB],
            users: usersInRoom(2, "hub"),
            actions: [
                { type: "addVoxel", userIndex: 0, row: ROW, col: COL, layer: 0, textures: TEXTURES, shape: QUARTER },
                // No shape given is a whole block, as every add was before blocks had shapes.
                { type: "addVoxel", userIndex: 0, row: ROW, col: COL + 2, layer: 0 },
            ],
            assertions: ({ users }) => {
                expect(shapeAt(ROW, COL)).toBe(QUARTER);
                expect(shapeAt(ROW, COL + 2)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);

                const told = blockSignalsSentTo(users[1]);
                expect(told.add.map(signal => [signal.quadIndex, signal.shape])).toEqual([
                    [quadIndexAt(ROW, COL), QUARTER], [quadIndexAt(ROW, COL + 2), VOXEL_BLOCK_SHAPE_WHOLE]]);
                expect(told.add[0].quadTextureIndicesWithinLayer).toEqual(TEXTURES);

                // Accepted edits are never echoed to whoever made them.
                expect(blockSignalsSentTo(users[0])).toEqual({add: [], remove: [], move: [], reshape: []});
            },
        });
    });

    it("refuses a block of a shape no block can have, and of no shape at all", async () => {
        await runScenario({
            name: "add a block of an invalid shape",
            rooms: [EMPTY_HUB],
            users: usersInRoom(2, "hub"),
            actions: [
                { type: "addVoxel", userIndex: 0, row: ROW, col: COL, layer: 0, shape: DIAGONAL },
                { type: "addVoxel", userIndex: 0, row: ROW, col: COL + 2, layer: 0, shape: VOXEL_BLOCK_SHAPE_EMPTY },
            ],
            assertions: ({ users }) => {
                expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_EMPTY);
                expect(shapeAt(ROW, COL + 2)).toBe(VOXEL_BLOCK_SHAPE_EMPTY);

                // The sender put a block up on their own screen, so they are told there is none.
                const answered = blockSignalsSentTo(users[0]);
                expect(answered.remove.map(signal => signal.quadIndex))
                    .toEqual([quadIndexAt(ROW, COL), quadIndexAt(ROW, COL + 2)]);
                expect(answered.add).toEqual([]);
                expect(blockSignalsSentTo(users[1])).toEqual({add: [], remove: [], move: [], reshape: []});
            },
        });
    });

    it("gives a block another shape where it stands, and tells the others", async () => {
        await runScenario({
            name: "reshape a block",
            rooms: [{ ...EMPTY_HUB, voxels: [{ row: ROW, col: COL, layer: 0 }] }],
            users: usersInRoom(2, "hub"),
            actions: [
                { type: "reshapeVoxel", userIndex: 0, row: ROW, col: COL, layer: 0, shape: LOW_X_HALF },
                { type: "reshapeVoxel", userIndex: 0, row: ROW, col: COL, layer: 0, shape: QUARTER },
                // A block may also be slid within its cell, or grown back.
                { type: "reshapeVoxel", userIndex: 0, row: ROW, col: COL, layer: 0, shape: HIGH_Z_HALF },
            ],
            assertions: ({ users }) => {
                expect(shapeAt(ROW, COL)).toBe(HIGH_Z_HALF);
                expect(ServerRoomManager.roomRuntimeMemories["hub"].room.dirty).toBe(true);

                const told = blockSignalsSentTo(users[1]);
                expect(told.reshape.map(signal => [signal.quadIndex, signal.shape])).toEqual([
                    [quadIndexAt(ROW, COL), LOW_X_HALF], [quadIndexAt(ROW, COL), QUARTER],
                    [quadIndexAt(ROW, COL), HIGH_Z_HALF]]);
                expect(blockSignalsSentTo(users[0])).toEqual({add: [], remove: [], move: [], reshape: []});
            },
        });
    });

    it("answers a refused reshape with the block as it is", async () => {
        await runScenario({
            name: "refused reshapes",
            rooms: [EMPTY_HUB],
            users: usersInRoom(2, "hub"),
            actions: [
                { type: "addVoxel", userIndex: 0, row: ROW, col: COL, layer: 0, textures: TEXTURES, shape: LOW_X_HALF },
                { type: "reshapeVoxel", userIndex: 0, row: ROW, col: COL, layer: 0, shape: DIAGONAL },
                // Taking a block away is a removal, never a reshape to nothing.
                { type: "reshapeVoxel", userIndex: 0, row: ROW, col: COL, layer: 0, shape: VOXEL_BLOCK_SHAPE_EMPTY },
                { type: "reshapeVoxel", userIndex: 0, row: ROW, col: COL, layer: 0, shape: 0xFF },
                // No block stands in the next cell to be given a shape.
                { type: "reshapeVoxel", userIndex: 0, row: ROW, col: COL + 1, layer: 0, shape: LOW_X_HALF },
            ],
            assertions: ({ users }) => {
                expect(shapeAt(ROW, COL)).toBe(LOW_X_HALF);
                expect(shapeAt(ROW, COL + 1)).toBe(VOXEL_BLOCK_SHAPE_EMPTY);

                // Each refusal is answered with the block the server holds: its shape and its textures.
                const answered = blockSignalsSentTo(users[0]);
                expect(answered.add.length).toBe(3);
                for (const signal of answered.add)
                {
                    expect(signal).toMatchObject({quadIndex: quadIndexAt(ROW, COL), shape: LOW_X_HALF,
                        quadTextureIndicesWithinLayer: TEXTURES});
                }
                expect(answered.remove.map(signal => signal.quadIndex)).toEqual([quadIndexAt(ROW, COL + 1)]);
                expect(answered.reshape).toEqual([]);

                // The others heard of the block going up, and of nothing since.
                const told = blockSignalsSentTo(users[1]);
                expect(told.add.length).toBe(1);
                expect(told.reshape).toEqual([]);
                expect(told.remove).toEqual([]);
            },
        });
    });

    it("moves a block with its shape", async () => {
        await runScenario({
            name: "move a shrunk block",
            rooms: [EMPTY_HUB],
            users: usersInRoom(2, "hub"),
            actions: [
                { type: "addVoxel", userIndex: 0, row: ROW, col: COL, layer: 0, textures: TEXTURES, shape: LOW_X_HALF },
                { type: "moveVoxel", userIndex: 0, row: ROW, col: COL, layer: 0, dRow: 0, dCol: 1, dLayer: 0 },
                { type: "moveVoxel", userIndex: 0, row: ROW, col: COL + 1, layer: 0, dRow: 0, dCol: 1, dLayer: 1 },
            ],
            assertions: ({ users }) => {
                expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_EMPTY);
                expect(shapeAt(ROW, COL + 1)).toBe(VOXEL_BLOCK_SHAPE_EMPTY);
                expect(shapeAt(ROW, COL + 2, 1)).toBe(LOW_X_HALF);

                // It took its textures along.
                const quads = ServerRoomManager.roomRuntimeMemories["hub"].room.voxelQuads;
                const first = quadIndexAt(ROW, COL + 2, 1);
                expect(Array.from(quads.subarray(first, first + TEXTURES.length))).toEqual(TEXTURES);

                const told = blockSignalsSentTo(users[1]);
                expect(told.move.map(signal => [signal.quadIndex, signal.colOffset, signal.collisionLayerOffset]))
                    .toEqual([[quadIndexAt(ROW, COL), 1, 0], [quadIndexAt(ROW, COL + 1), 1, 1]]);
                expect(blockSignalsSentTo(users[0])).toEqual({add: [], remove: [], move: [], reshape: []});
            },
        });
    });

    it("answers a refused move with what both of its cells hold", async () => {
        await runScenario({
            name: "refused moves",
            rooms: [EMPTY_HUB],
            users: usersInRoom(2, "hub"),
            actions: [
                { type: "addVoxel", userIndex: 0, row: ROW, col: COL, layer: 0, textures: TEXTURES, shape: LOW_X_HALF },
                { type: "addVoxel", userIndex: 0, row: ROW, col: COL + 1, layer: 0, shape: QUARTER },
            ],
            assertions: ({ users }) => {
                const sender = users[0];
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                // What the sender is answered with for one move, which each of these is refused.
                const answerTo = (row: number, col: number, dRow: number, dCol: number, dLayer: number) => {
                    sender.socketUserContext.clearAllPendingSignalsToUser();
                    ServerVoxelManager.onMoveVoxelBlockSignalReceived(sender.socketUserContext,
                        new MoveVoxelBlockSignal(room.id, quadIndexAt(row, col), dRow, dCol, dLayer));
                    const answered = blockSignalsSentTo(sender);
                    expect(answered.move).toEqual([]);
                    expect(answered.reshape).toEqual([]);
                    return {
                        add: answered.add.map(signal => [signal.quadIndex, signal.shape]),
                        remove: answered.remove.map(signal => signal.quadIndex),
                    };
                };

                // A cell layer that holds a block takes no other, however little of it that block fills.
                expect(answerTo(ROW, COL, 0, 1, 0)).toEqual({
                    add: [[quadIndexAt(ROW, COL), LOW_X_HALF], [quadIndexAt(ROW, COL + 1), QUARTER]], remove: []});

                // A block that is not there (somebody else took it away first, say): the server holds
                // neither cell, and says so of both, whatever the sender's own copy made of the move.
                expect(answerTo(ROW + 3, COL, 1, 0, 0)).toEqual({
                    add: [], remove: [quadIndexAt(ROW + 3, COL), quadIndexAt(ROW + 4, COL)]});

                // Below the lowest layer there is no cell to speak of, only the one it was taken from.
                expect(answerTo(ROW, COL, 0, 0, -1)).toEqual({
                    add: [[quadIndexAt(ROW, COL), LOW_X_HALF]], remove: []});

                // Nothing moved, and nobody else heard of any of it.
                expect(shapeAt(ROW, COL)).toBe(LOW_X_HALF);
                expect(shapeAt(ROW, COL + 1)).toBe(QUARTER);
                expect(shapeAt(ROW + 1, COL)).toBe(VOXEL_BLOCK_SHAPE_EMPTY);
                const told = blockSignalsSentTo(users[1]);
                expect(told.add.length).toBe(2);
                expect([told.move, told.remove, told.reshape]).toEqual([[], [], []]);
            },
        });
    });

    it("refuses a reshape that would leave a canvas without its wall, and takes one that does not", async () => {
        // A two-layer wall, with a canvas covering the face that looks back towards the room.
        const WALL_ROW = 8;
        const WALL_COL = 8;
        await runScenario({
            name: "reshaping a block that holds a canvas",
            rooms: [{ ...EMPTY_HUB, voxels: [
                { row: WALL_ROW, col: WALL_COL, layer: 0 },
                { row: WALL_ROW, col: WALL_COL, layer: 1 },
            ] }],
            users: usersInRoom(2, "hub"),
            assertions: ({ users }) => {
                const sender = users[0];
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const canvas = new AddObjectSignal(room.id, sender.user.id, sender.user.userName,
                    ObjectTypeConfigMap.getIndexByType("Canvas"), "canvas-on-wall",
                    new ObjectTransform({ x: WALL_COL + 0.5, y: 0.5, z: WALL_ROW }, { x: 0, y: 0, z: -1 },
                        {...UNIT_VEC3}));
                expect(ObjectUpdateUtil.addObject(sender.user, room, canvas)).toBe(true);
                sender.socketUserContext.clearAllPendingSignalsToUser();
                users[1].socketUserContext.clearAllPendingSignalsToUser();

                const quadIndex = quadIndexAt(WALL_ROW, WALL_COL);
                const reshape = (shape: number) => ServerVoxelManager.onSetVoxelBlockShapeSignalReceived(
                    sender.socketUserContext, new SetVoxelBlockShapeSignal(room.id, quadIndex, shape));

                // The half away from the canvas leaves nothing behind it; the half along it leaves half of
                // it hanging in the air.
                reshape(HIGH_Z_HALF);
                reshape(LOW_X_HALF);
                expect(shapeAt(WALL_ROW, WALL_COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
                expect(blockSignalsSentTo(sender).add.map(signal => [signal.quadIndex, signal.shape]))
                    .toEqual([[quadIndex, VOXEL_BLOCK_SHAPE_WHOLE], [quadIndex, VOXEL_BLOCK_SHAPE_WHOLE]]);
                expect(blockSignalsSentTo(users[1]).reshape).toEqual([]);

                // The half the canvas hangs on is all the canvas needs: the wall may be made thin.
                reshape(LOW_Z_HALF);
                expect(shapeAt(WALL_ROW, WALL_COL)).toBe(LOW_Z_HALF);
                expect(blockSignalsSentTo(users[1]).reshape.map(signal => signal.shape)).toEqual([LOW_Z_HALF]);
                expect(ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex))
                    .toEqual([canvas.objectId]);
                expect(ObjectAttachmentUtil.canPlaceObject(room, canvas.objectId, canvas.objectTypeIndex,
                    canvas.transform)).toBe(true);

                // With the canvas down, the block is anybody's to shape.
                expect(ObjectUpdateUtil.removeObject(sender.user, room,
                    new RemoveObjectSignal(room.id, canvas.objectId))).toBe(true);
                reshape(HIGH_Z_HALF);
                expect(shapeAt(WALL_ROW, WALL_COL)).toBe(HIGH_Z_HALF);
            },
        });
    });

    it("refuses to shrink the wall a door hangs on", async () => {
        // A door needs whole blocks behind it (see DoorObjectTypeConfig): arrivals stand in that wall's cell.
        const DOOR = {row: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, col: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL};
        await runScenario({
            name: "the wall a door hangs on, shrunk",
            rooms: [EMPTY_HUB],
            users: usersInRoom(2, "hub"),
            actions: [
                { type: "reshapeVoxel", userIndex: 0, row: DOOR.row, col: DOOR.col, layer: 0, shape: LOW_X_HALF },
                { type: "reshapeVoxel", userIndex: 0, row: DOOR.row, col: DOOR.col, layer: 0, shape: LOW_Z_HALF },
                { type: "reshapeVoxel", userIndex: 0, row: DOOR.row, col: DOOR.col, layer: 0, shape: HIGH_Z_HALF },
                // The same wall three cells over, which holds nothing up, as a control.
                { type: "reshapeVoxel", userIndex: 0, row: DOOR.row, col: DOOR.col - 3, layer: 0, shape: LOW_X_HALF },
            ],
            assertions: ({ users }) => {
                expect(shapeAt(DOOR.row, DOOR.col), "the wall the room's door hangs on was shrunk")
                    .toBe(VOXEL_BLOCK_SHAPE_WHOLE);
                expect(shapeAt(DOOR.row, DOOR.col - 3)).toBe(LOW_X_HALF);
                expect(blockSignalsSentTo(users[0]).add.map(signal => [signal.quadIndex, signal.shape])).toEqual(
                    new Array(3).fill([quadIndexAt(DOOR.row, DOOR.col), VOXEL_BLOCK_SHAPE_WHOLE]));
                expect(blockSignalsSentTo(users[1]).reshape.map(signal => signal.quadIndex))
                    .toEqual([quadIndexAt(DOOR.row, DOOR.col - 3)]);
            },
        });
    });
});

/** The boundary wall is whole (the door hangs on it), so it stops players everywhere, entrance included. */
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
            PhysicsColliderStateUtil.getObjectColliderState(playerTypeIndex,
                new ObjectTransform(pos, dir, {...UNIT_VEC3}))!);

        const deltaTime = 1 / 60;
        for (let frame = 0; frame < 120; ++frame)
        {
            const desired: Vec3 = { x: 0, y: -GRAVITY_SPEED, z: 3 };
            const adjusted = PhysicsManager.getAdjustedVelocity(room.id, objectId, desired);
            const target: Vec3 = { x: pos.x + adjusted.x * deltaTime, y: pos.y + adjusted.y * deltaTime,
                z: pos.z + adjusted.z * deltaTime };
            pos = PhysicsManager.setObjectTransform(room.id, objectId,
                new ObjectTransform(target, dir, {...UNIT_VEC3}), false).transform.pos;
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

                // At the entrance cell the player stops at the wall on either storey, with no invisible collider.
                const groundZ = walkTowardsEntrance(room, startZ, COLLISION_LAYER_MIN - 1);
                expect(groundZ).toBeLessThan(INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW);

                const upperZ = walkTowardsEntrance(room, startZ, STOREY_FLOOR_COLLISION_LAYER);
                expect(upperZ).toBeLessThan(INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW);
            },
        });
    });

    it("takes a wall attachment on the faces inside an opening cut through it", async () => {
        // An opening in the boundary wall has reveal walls within its thickness, so attachments on them are
        // the only ones positioned inside the boundary ring.
        const HOLE_ROW = 8;
        const HOLE_COL = 0;
        await runScenario({
            name: "an opening in the boundary wall",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [
                { type: "removeVoxel", userIndex: 0, row: HOLE_ROW, col: HOLE_COL, layer: 2 },
                { type: "removeVoxel", userIndex: 0, row: HOLE_ROW, col: HOLE_COL, layer: 3 },
            ],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
                const hangs = (pos: Vec3, dir: Vec3) => ObjectAttachmentUtil.canPlaceObject(
                    room, "attachment", canvasTypeIndex,
                    new ObjectTransform(pos, dir, {...UNIT_VEC3}));

                // The cell the opening was cut through is gone from the wall...
                const holed = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, HOLE_ROW, HOLE_COL)!;
                expect(VoxelQueryUtil.isVoxelBlockPresent(holed, 2)).toBe(false);

                // ...and a picture hangs on either reveal, facing along the wall, at the opening's height.
                expect(hangs({ x: 0.5, y: 1.5, z: HOLE_ROW }, { x: 0, y: 0, z: 1 })).toBe(true);
                expect(hangs({ x: 0.5, y: 1.5, z: HOLE_ROW + 1 }, { x: 0, y: 0, z: -1 })).toBe(true);

                // Still refused: an attachment across the wall's inner face, half buried in the boundary...
                expect(hangs({ x: 1, y: 1.5, z: HOLE_ROW }, { x: 0, y: 0, z: 1 })).toBe(false);
                // ...and one hung on the wall's outward face, looking out of the room at nothing.
                expect(hangs({ x: 0, y: 1.5, z: 12.5 }, { x: -1, y: 0, z: 0 })).toBe(false);
            },
        });
    });

    it("asks a resized attachment for the wall its own size needs, not its type's", async () => {
        // A canvas stretched past the block work holding it has nothing to hang from, whatever its
        // origin cell says.
        const WALL_ROW = 8;
        const WALL_COL = 8;
        await runScenario({
            name: "a resized canvas on a patch of wall",
            rooms: [{ ...EMPTY_HUB, voxels: [
                // Two cells wide and two layers tall: room for a 1x1 canvas, not for a 2.5x2.5 one.
                { row: WALL_ROW, col: WALL_COL, layer: 0 },
                { row: WALL_ROW, col: WALL_COL, layer: 1 },
                { row: WALL_ROW, col: WALL_COL + 1, layer: 0 },
                { row: WALL_ROW, col: WALL_COL + 1, layer: 1 },
            ] }],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
                const hangsAtScale = (scale: number) => ObjectAttachmentUtil.canPlaceObject(
                    room, "attachment", canvasTypeIndex,
                    new ObjectTransform({ x: WALL_COL + 1, y: 0.5, z: WALL_ROW },
                        { x: 0, y: 0, z: -1 }, {x: scale, y: scale, z: 1}));

                expect(hangsAtScale(1)).toBe(true);
                expect(hangsAtScale(2.5)).toBe(false);
            },
        });
    });

    it("hangs a widened attachment that the wall does reach behind", async () => {
        const WALL_ROW = 8;
        const WALL_COL = 8;
        const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
        // A patch the largest canvas just covers, hung in its middle: exactly as tall, and a cell wider.
        const largest = ObjectScaleUtil.getMaxObjectSize(canvasTypeIndex);
        const cols = [...Array(Math.ceil(largest.x) + 1).keys()];
        const layers = [...Array(Math.ceil(largest.y / COLLISION_LAYER_HEIGHT)).keys()];
        await runScenario({
            name: "a wide patch of wall",
            rooms: [{ ...EMPTY_HUB, voxels: cols.flatMap(col => layers.map(
                layer => ({ row: WALL_ROW, col: WALL_COL + col, layer }))) }],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const canvasConfig = ObjectTypeConfigMap.getConfigByIndex(canvasTypeIndex);
                const hangsAtScale = (scale: number) => ObjectAttachmentUtil.canPlaceObject(
                    room, "attachment", canvasTypeIndex,
                    new ObjectTransform({ x: WALL_COL + 0.5 * cols.length, y: 0.5 * largest.y, z: WALL_ROW },
                        { x: 0, y: 0, z: -1 }, {x: scale, y: scale, z: 1}));

                for (let scale = canvasConfig.scaling!.minScale.x;
                    scale <= canvasConfig.scaling!.maxScale.x;
                    scale += canvasConfig.scaling!.scaleStep.x)
                {
                    expect(hangsAtScale(scale), `a canvas at ${scale}x found no wall`).toBe(true);
                }
            },
        });
    });
});

/**
 * The room encodes into one reusable buffer, and typed arrays silently ignore out-of-bounds writes, so an
 * undersized buffer would truncate a full room. Tested with a fully solid room (the costliest to write).
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
            expect(VoxelQueryUtil.getVoxelBlockLayerMask(voxel)).toBe((1 << NUM_COLLISION_LAYERS) - 1);

        const bufferState = EncodingUtil.startEncoding();
        voxelGrid.encode(bufferState);
        const bytes = new Uint8Array(EncodingUtil.endEncoding(bufferState));

        // Nothing was dropped on the way out...
        expect(bytes.length).toBeLessThanOrEqual(MAX_ENCODED_VOXEL_GRID_BYTES);

        // ...and the room that comes back is the room that went in.
        const reloaded = VoxelGrid.decode(new BufferState(bytes)) as VoxelGrid;
        expect(reloaded.voxels.length).toBe(NUM_VOXEL_ROWS * NUM_VOXEL_COLS);
        expect(reloaded.voxels.map(v => VoxelQueryUtil.getVoxelBlockLayerMask(v)))
            .toEqual(voxelGrid.voxels.map(v => VoxelQueryUtil.getVoxelBlockLayerMask(v)));
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
