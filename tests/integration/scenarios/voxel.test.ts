/**
 * Scenario tests: voxel operations — add, remove, move, texture, border restrictions, mixed sequences,
 * collision layers, the dirty flag, and entrance protection (the door itself, not a reserved area).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario, VoxelPlacement } from "../helpers/scenarioRunner";
import { EMPTY_REGULAR, EMPTY_HUB, userAtCenter, usersInRoom, buildColumn, removeColumn } from "../helpers/scenarioPresets";
import { getPendingSignals } from "../helpers/invariants";
import { ConnectedUser } from "../helpers/serverHarness";
import { Action } from "../helpers/actions";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerVoxelManager from "../../../src/server/voxel/serverVoxelManager";
import AddVoxelBlockSignal from "../../../src/shared/voxel/types/update/addVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/removeVoxelBlockSignal";
import MoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/moveVoxelBlockSignal";
import { addRestrictedZone } from "../helpers/restrictedZone";
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
    GENERATED_WALL_THICKNESS, MAX_ENCODED_VOXEL_GRID_BYTES, INITIAL_MULTI_PLAYER_ENTRANCE_POS,
    NUM_COLLISION_LAYERS, NUM_COLLISION_LAYERS_PER_STOREY, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER,
    NUM_VOXEL_ROWS, STOREY_FLOOR_COLLISION_LAYER,
    UNIT_VEC3, VOXEL_CELL_SIZE } from "../../../src/shared/system/sharedConstants";
import { PLAYER_HEIGHT } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import DoorObjectTypeConfig, { ENTRANCE_DOOR_OBJECT_ID } from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
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

const VOXELS_PER_WORLD_UNIT = 1 / VOXEL_CELL_SIZE;

// The voxel rows (or columns) through a boundary wall's thickness, from the first of them.
function voxelsThroughWall(first: number): number[]
{
    return Array.from({length: GENERATED_WALL_THICKNESS}, (_, i) => first + i);
}

// Where the entrance door hangs, in the world: on the face the boundary wall turns to the room (see
// DoorObjectTypeConfig.util.makeEntranceDoor), and the rows of that wall behind it.
const ENTRANCE_DOOR_X = INITIAL_MULTI_PLAYER_ENTRANCE_POS.x;
const ENTRANCE_WALL_Z = INITIAL_MULTI_PLAYER_ENTRANCE_POS.z;
const ENTRANCE_WALL_ROWS = voxelsThroughWall(VoxelQueryUtil.getVoxelRowFromWorldZ(ENTRANCE_WALL_Z));

// The voxel columns and layers of a wall that any part of something hung on it lies before, by its own
// place and size (it faces along z, so it reaches across x and up y).
function getWallBehind(objectTypeIndex: number, transform: ObjectTransform): {cols: number[], layers: number[]}
{
    const size = ObjectScaleUtil.getObjectSize(objectTypeIndex, transform.scale);
    const cols: number[] = [];
    for (let col = 0; col < NUM_VOXEL_COLS; ++col)
    {
        const distance = Math.abs(VoxelQueryUtil.getWorldXAtVoxelColCenter(col) - transform.pos.x);
        if (distance < 0.5 * (VOXEL_CELL_SIZE + size.x))
            cols.push(col);
    }
    const layers: number[] = [];
    for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
    {
        const distance = Math.abs(VoxelQueryUtil.getWorldYAtVoxelCollisionLayerCenter(layer) - transform.pos.y);
        if (distance < 0.5 * (COLLISION_LAYER_HEIGHT + size.y))
            layers.push(layer);
    }
    return {cols, layers};
}

// The wall behind the entrance door a multiplayer room comes with (a bare one too; see
// buildBareMultiplayerRoomContent), through the boundary wall's whole thickness.
function getWallBehindEntranceDoor(): {rows: number[], cols: number[], layers: number[]}
{
    const door = DoorObjectTypeConfig.util.makeEntranceDoor("", INITIAL_MULTI_PLAYER_ENTRANCE_POS);
    return {
        rows: ENTRANCE_WALL_ROWS,
        ...getWallBehind(door.objectTypeIndex, door.transform),
    };
}

// The blocks of a wall one voxel thick standing on the room's floor along a row, to seed a room with.
function wallBlocks(row: number, colStart: number, numCols: number, numLayers: number,
    textures?: [number, number, number, number, number, number]): VoxelPlacement[]
{
    const blocks: VoxelPlacement[] = [];
    for (let col = colStart; col < colStart + numCols; ++col)
    {
        for (let layer = 0; layer < numLayers; ++layer)
            blocks.push({ row, col, layer, textures });
    }
    return blocks;
}

// The middle of the face such a wall turns towards -z.
function wallFaceCenter(row: number, colStart: number, numCols: number, numLayers: number): Vec3
{
    const first = VoxelQueryUtil.getVoxelBlockBox(row, colStart, 0);
    const last = VoxelQueryUtil.getVoxelBlockBox(row, colStart + numCols - 1, numLayers - 1);
    return {
        x: 0.5 * (first.center.x + last.center.x),
        y: 0.5 * (first.center.y + last.center.y),
        z: first.center.z - first.halfSize.z,
    };
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
        const behindDoor = getWallBehindEntranceDoor();
        // The same wall just clear of the door on either side, which holds nothing up → editable, as a control.
        const plainCols = [behindDoor.cols[0] - 1, behindDoor.cols[behindDoor.cols.length - 1] + 1];
        // (Each column through the wall's whole thickness.)
        const removalOf = (cols: number[]): Action[] => behindDoor.rows.flatMap(row => cols.map(
            col => ({ type: "removeVoxel" as const, userIndex: 0, row, col, layer: 0 })));
        await runScenario({
            name: "the wall a door hangs on",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [...removalOf(behindDoor.cols), ...removalOf(plainCols)],
            assertions: () => {
                const voxels = ServerRoomManager.roomRuntimeMemories["hub"].room.voxelGrid.voxels;
                expect(behindDoor.cols.length).toBeGreaterThan(0);
                for (const row of behindDoor.rows)
                {
                    for (const col of behindDoor.cols)
                    {
                        const wallBehindDoor = VoxelQueryUtil.getVoxel(voxels, row, col)!;
                        expect(VoxelQueryUtil.isVoxelBlockPresent(wallBehindDoor, 0),
                            `the wall the room's door hangs on was taken out at (${row}, ${col})`).toBe(true);
                    }
                    for (const col of plainCols)
                    {
                        const plainWall = VoxelQueryUtil.getVoxel(voxels, row, col)!;
                        expect(VoxelQueryUtil.isVoxelBlockPresent(plainWall, 0), `(${row}, ${col})`).toBe(false);
                    }
                }
            },
        });
    });

    it("keeps the wall behind a door two blocks deep, where a canvas needs only the blocks it hangs on", async () => {
        // Arrivals stand inside the wall behind a door (see DoorObjectTypeConfig), so it rests on that wall
        // through the boundary's whole thickness, and across all of its own footprint.
        await runScenario({
            name: "the depth of wall behind a door",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const voxels = room.voxelGrid.voxels;
                const door = room.objectById[ENTRANCE_DOOR_OBJECT_ID];
                expect(door.transform.pos).toMatchObject({x: ENTRANCE_DOOR_X, z: ENTRANCE_WALL_Z});
                const [innerWallRow, outerWallRow] = ENTRANCE_WALL_ROWS;
                const behindDoor = getWallBehind(door.objectTypeIndex, door.transform);
                expect(behindDoor.cols.length * behindDoor.layers.length).toBeGreaterThan(0);

                const quadIndexAt = (row: number, col: number, layer: number) =>
                    VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, layer);
                const doorStands = () => ObjectAttachmentUtil.canPlaceObject(
                    room, door.objectId, door.objectTypeIndex, door.transform);
                expect(doorStands()).toBe(true);

                // All along the wall, at either depth: a block behind the door holds it, cannot go, and is one
                // the door would not stand without; no other block holds anything.
                for (const row of [innerWallRow, outerWallRow])
                {
                    for (let col = 0; col < NUM_VOXEL_COLS; ++col)
                    {
                        for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
                        {
                            const quadIndex = quadIndexAt(row, col, layer);
                            const isBehindDoor = behindDoor.cols.includes(col) && behindDoor.layers.includes(layer);
                            const where = `(${row}, ${col}, ${layer})`;
                            expect(ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex), where)
                                .toEqual(isBehindDoor ? [door.objectId] : []);
                            expect(VoxelUpdateUtil.canRemoveVoxelBlock(actingUser, room, quadIndex), where)
                                .toBe(!isBehindDoor);
                            if (!isBehindDoor)
                                continue;

                            VoxelUpdateUtil.removeVoxelBlock(undefined, voxels, quadIndex);
                            expect(doorStands(), where).toBe(false);
                            VoxelUpdateUtil.addVoxelBlock(undefined, voxels, quadIndex);
                        }
                    }
                }
                expect(doorStands()).toBe(true);

                // A canvas beside the door stays up with the wall's outer blocks gone from behind it.
                const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
                const canvasTransform = new ObjectTransform(
                    { x: ENTRANCE_DOOR_X - 3, y: 1, z: ENTRANCE_WALL_Z }, { x: 0, y: 0, z: -1 }, {...UNIT_VEC3});
                const behindCanvas = getWallBehind(canvasTypeIndex, canvasTransform);
                expect(behindCanvas.cols.length * behindCanvas.layers.length).toBeGreaterThan(0);
                for (const col of behindCanvas.cols)
                {
                    for (const layer of behindCanvas.layers)
                        VoxelUpdateUtil.removeVoxelBlock(undefined, voxels, quadIndexAt(outerWallRow, col, layer));
                }
                expect(ObjectAttachmentUtil.canPlaceObject(room, "attachment", canvasTypeIndex, canvasTransform))
                    .toBe(true);
            },
        });
    });

    it("builds and hangs freely right up to the entrance, which nothing reserves any more", async () => {
        // The floor before a door and the wall beside it are ordinary space to build and hang on.
        const ROW_BEFORE_WALL = VoxelQueryUtil.getVoxelRowFromWorldZ(ENTRANCE_WALL_Z) - 1;
        const COL_BEFORE_DOOR = VoxelQueryUtil.getVoxelColFromWorldX(ENTRANCE_DOOR_X);
        await runScenario({
            name: "no entrance zones",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: [
                { type: "addVoxel", userIndex: 0, row: ROW_BEFORE_WALL, col: COL_BEFORE_DOOR, layer: 0 },
            ],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const inFrontOfDoor = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, ROW_BEFORE_WALL, COL_BEFORE_DOOR)!;
                expect(VoxelQueryUtil.isVoxelBlockPresent(inFrontOfDoor, 0)).toBe(true);

                // A picture beside the door, clear of the door's footprint (the only thing keeping it off that wall).
                const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
                const canHang = ObjectAttachmentUtil.canPlaceObject(room, "attachment",
                    canvasTypeIndex, new ObjectTransform(
                        { x: ENTRANCE_DOOR_X - 3, y: 1, z: ENTRANCE_WALL_Z }, { x: 0, y: 0, z: -1 }, {...UNIT_VEC3}));
                expect(canHang).toBe(true);
            },
        });
    });

    it("a block holding a canvas can only be removed once the canvas goes first", async () => {
        // A wall as wide and as tall as a canvas, with one hung on the face that looks back towards the room.
        const WALL_ROW = 8;
        const WALL_COL = 8;
        const NUM_WALL_COLS = VOXELS_PER_WORLD_UNIT;
        const NUM_WALL_LAYERS = 2;
        const wall = wallBlocks(WALL_ROW, WALL_COL, NUM_WALL_COLS, NUM_WALL_LAYERS);
        await runScenario({
            name: "canvas on a wall block",
            rooms: [{ ...EMPTY_HUB, voxels: wall }],
            users: [userAtCenter("hub")],
            assertions: ({ users }) => {
                const user = users[0].user;
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const canvas = new AddObjectSignal(room.id, user.id, user.userName,
                    ObjectTypeConfigMap.getIndexByType("Canvas"), "canvas-on-wall",
                    new ObjectTransform(wallFaceCenter(WALL_ROW, WALL_COL, NUM_WALL_COLS, NUM_WALL_LAYERS),
                        { x: 0, y: 0, z: -1 }, {...UNIT_VEC3}));
                expect(ObjectUpdateUtil.addObject(user, room, canvas)).toBe(true);

                const quadIndices = wall.map(
                    block => VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(block.row, block.col, block.layer));
                expect(quadIndices.length).toBe(NUM_WALL_COLS * NUM_WALL_LAYERS);

                for (const quadIndex of quadIndices)
                {
                    // Each block is part of what keeps the canvas on the wall, so it cannot go by itself...
                    expect(ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex))
                        .toEqual([canvas.objectId]);
                    expect(VoxelUpdateUtil.canRemoveVoxelBlock(actingUser, room, quadIndex)).toBe(false);
                    // ...but the block and its attachments may be removed together, as the user is offered.
                    expect(VoxelUpdateUtil.canRemoveVoxelBlockWithItsAttachments(
                        actingUser, room, quadIndex)).toBe(true);
                }

                // With the canvas down first, the blocks may follow (the menu's removal order).
                expect(ObjectUpdateUtil.removeObject(user, room,
                    new RemoveObjectSignal(room.id, canvas.objectId))).toBe(true);
                for (const quadIndex of quadIndices)
                {
                    expect(ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex)).toEqual([]);
                    expect(VoxelUpdateUtil.canRemoveVoxelBlock(actingUser, room, quadIndex)).toBe(true);
                }
            },
        });
    });

    it("a block holds the lamps standing on it and hanging under it, and only those", async () => {
        // One block up in the air: a lamp on its top, one under it, and one on the room floor beneath, near
        // enough to be looked at for it (see ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock).
        const ROW = 8;
        const COL = 8;
        const LAYER = 1;
        await runScenario({
            name: "lamps on a floating block",
            rooms: [{ ...EMPTY_HUB, voxels: [{ row: ROW, col: COL, layer: LAYER }] }],
            users: [userAtCenter("hub")],
            assertions: ({ users }) => {
                const user = users[0].user;
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
                // The smallest lamp, which is as large as a block's top.
                const lampScale = ObjectTypeConfigMap.getConfigByIndex(lampTypeIndex).scaling!.minScale;
                const block = VoxelQueryUtil.getVoxelBlockBox(ROW, COL, LAYER);
                const lamp = (objectId: string, y: number, dirY: number) => new AddObjectSignal(room.id,
                    user.id, user.userName, lampTypeIndex, objectId, new ObjectTransform(
                        { x: block.center.x, y, z: block.center.z }, { x: 0, y: dirY, z: 0 }, {...lampScale}));

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
 * Block edits as the server takes them: one it accepts is told to the others in the room and never echoed
 * to its sender, and one it refuses is answered to its sender alone, with what the cell layers it touched
 * really hold.
 */
describe("block edits, relayed or refused", () => {
    const TEXTURES: [number, number, number, number, number, number] = [1, 2, 3, 4, 5, 6];
    const OTHER_TEXTURES: [number, number, number, number, number, number] = [7, 8, 9, 10, 11, 12];
    const ROW = 10;
    const COL = 10;

    const hub = () => ServerRoomManager.roomRuntimeMemories["hub"].room;
    const quadIndexAt = (row: number, col: number, layer: number = 0) =>
        VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, layer);
    const blockAt = (row: number, col: number, layer: number = 0) =>
        VoxelQueryUtil.isVoxelBlockPresentAt(hub().voxelGrid.voxels, row, col, layer);
    const texturesAt = (row: number, col: number, layer: number = 0) => {
        const first = quadIndexAt(row, col, layer);
        return Array.from(hub().voxelQuads.subarray(first, first + NUM_VOXEL_QUADS_PER_COLLISION_LAYER));
    };

    // What a user has been sent about blocks, in the terms of the three signals that say it.
    function blockSignalsSentTo(user: ConnectedUser): {[signalType: string]: any[]}
    {
        return {
            add: getPendingSignals(user, "addVoxelBlockSignal"),
            remove: getPendingSignals(user, "removeVoxelBlockSignal"),
            move: getPendingSignals(user, "moveVoxelBlockSignal"),
        };
    }

    // What a sender is answered with for one edit of theirs: the blocks they are told stand (each by its
    // cell layer and its textures) and the cell layers they are told stand empty. Nothing, if it was taken.
    function answerTo(sender: ConnectedUser, edit: () => void): {add: [number, number[]][], remove: number[]}
    {
        sender.socketUserContext.clearAllPendingSignalsToUser();
        edit();
        const answered = blockSignalsSentTo(sender);
        expect(answered.move).toEqual([]);
        return {
            add: answered.add.map(signal => [signal.quadIndex, signal.quadTextureIndicesWithinLayer]),
            remove: answered.remove.map(signal => signal.quadIndex),
        };
    }

    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("puts up a block with the textures asked for, and tells the others", async () => {
        await runScenario({
            name: "add a block",
            rooms: [EMPTY_HUB],
            users: usersInRoom(2, "hub"),
            actions: [
                { type: "addVoxel", userIndex: 0, row: ROW, col: COL, layer: 0, textures: TEXTURES },
                { type: "addVoxel", userIndex: 0, row: ROW, col: COL + 2, layer: 0, textures: OTHER_TEXTURES },
            ],
            assertions: ({ users }) => {
                expect(blockAt(ROW, COL)).toBe(true);
                expect(blockAt(ROW, COL + 2)).toBe(true);
                expect([texturesAt(ROW, COL), texturesAt(ROW, COL + 2)]).toEqual([TEXTURES, OTHER_TEXTURES]);
                expect(hub().dirty).toBe(true);

                const told = blockSignalsSentTo(users[1]);
                expect(told.add.map(signal => [signal.quadIndex, signal.quadTextureIndicesWithinLayer])).toEqual([
                    [quadIndexAt(ROW, COL), TEXTURES], [quadIndexAt(ROW, COL + 2), OTHER_TEXTURES]]);
                expect([told.remove, told.move]).toEqual([[], []]);

                // Accepted edits are never echoed to whoever made them.
                expect(blockSignalsSentTo(users[0])).toEqual({add: [], remove: [], move: []});
            },
        });
    });

    it("answers a refused add with what its cell holds", async () => {
        // A zone only the room's superuser builds in, and a voxel inside it.
        const ZONE = {rowMin: 16, rowMax: 17, colMin: 16, colMax: 17};
        const ZONED = {row: ZONE.rowMin, col: ZONE.colMin};
        await runScenario({
            name: "refused adds",
            rooms: [EMPTY_HUB],
            users: usersInRoom(2, "hub"),
            actions: [
                { type: "addVoxel", userIndex: 0, row: ROW, col: COL, layer: 0, textures: TEXTURES },
            ],
            assertions: ({ users }) => {
                const sender = users[0];
                const room = hub();
                room.dirty = false;
                const add = (row: number, col: number, textures: number[]) => answerTo(sender,
                    () => ServerVoxelManager.onAddVoxelBlockSignalReceived(sender.socketUserContext,
                        new AddVoxelBlockSignal(room.id, quadIndexAt(row, col), textures)));

                // A cell layer that holds a block takes no other: the sender is told of the one standing
                // there, which the one on their own screen takes its textures from.
                expect(add(ROW, COL, OTHER_TEXTURES)).toEqual({add: [[quadIndexAt(ROW, COL), TEXTURES]], remove: []});
                expect(texturesAt(ROW, COL)).toEqual(TEXTURES);

                // The sender put a block up on their own screen, so where there is none they are told so.
                addRestrictedZone(room, ZONE);
                expect(add(ZONED.row, ZONED.col, TEXTURES)).toEqual(
                    {add: [], remove: [quadIndexAt(ZONED.row, ZONED.col)]});
                expect(blockAt(ZONED.row, ZONED.col)).toBe(false);

                // Neither left the room to be saved, and the others heard of the first block going up alone.
                expect(room.dirty).toBe(false);
                const told = blockSignalsSentTo(users[1]);
                expect(told.add.length).toBe(1);
                expect([told.remove, told.move]).toEqual([[], []]);
            },
        });
    });

    it("moves a block with its textures, and tells the others", async () => {
        await runScenario({
            name: "move a block",
            rooms: [EMPTY_HUB],
            users: usersInRoom(2, "hub"),
            actions: [
                { type: "addVoxel", userIndex: 0, row: ROW, col: COL, layer: 0, textures: TEXTURES },
                { type: "moveVoxel", userIndex: 0, row: ROW, col: COL, layer: 0, dRow: 0, dCol: 1, dLayer: 0 },
                { type: "moveVoxel", userIndex: 0, row: ROW, col: COL + 1, layer: 0, dRow: 0, dCol: 1, dLayer: 1 },
            ],
            assertions: ({ users }) => {
                expect(blockAt(ROW, COL)).toBe(false);
                expect(blockAt(ROW, COL + 1)).toBe(false);
                expect(blockAt(ROW, COL + 2, 1)).toBe(true);

                // It took its textures along.
                expect(texturesAt(ROW, COL + 2, 1)).toEqual(TEXTURES);

                const told = blockSignalsSentTo(users[1]);
                expect(told.move.map(signal => [signal.quadIndex, signal.colOffset, signal.collisionLayerOffset]))
                    .toEqual([[quadIndexAt(ROW, COL), 1, 0], [quadIndexAt(ROW, COL + 1), 1, 1]]);
                expect(blockSignalsSentTo(users[0])).toEqual({add: [], remove: [], move: []});
            },
        });
    });

    it("answers a refused move with what both of its cells hold", async () => {
        await runScenario({
            name: "refused moves",
            rooms: [EMPTY_HUB],
            users: usersInRoom(2, "hub"),
            actions: [
                { type: "addVoxel", userIndex: 0, row: ROW, col: COL, layer: 0, textures: TEXTURES },
                { type: "addVoxel", userIndex: 0, row: ROW, col: COL + 1, layer: 0, textures: OTHER_TEXTURES },
            ],
            assertions: ({ users }) => {
                const sender = users[0];
                const room = hub();
                room.dirty = false;
                // (Each of these moves is refused.)
                const move = (row: number, col: number, dRow: number, dCol: number, dLayer: number) => answerTo(sender,
                    () => ServerVoxelManager.onMoveVoxelBlockSignalReceived(sender.socketUserContext,
                        new MoveVoxelBlockSignal(room.id, quadIndexAt(row, col), dRow, dCol, dLayer)));

                // A cell layer that holds a block takes no other.
                expect(move(ROW, COL, 0, 1, 0)).toEqual({
                    add: [[quadIndexAt(ROW, COL), TEXTURES], [quadIndexAt(ROW, COL + 1), OTHER_TEXTURES]], remove: []});

                // A block that is not there (somebody else took it away first, say): the server holds
                // neither cell, and says so of both, whatever the sender's own copy made of the move.
                expect(move(ROW + 3, COL, 1, 0, 0)).toEqual({
                    add: [], remove: [quadIndexAt(ROW + 3, COL), quadIndexAt(ROW + 4, COL)]});

                // Below the lowest layer there is no cell to speak of, only the one it was taken from.
                expect(move(ROW, COL, 0, 0, -1)).toEqual({add: [[quadIndexAt(ROW, COL), TEXTURES]], remove: []});

                // Nothing moved, and nobody else heard of any of it.
                expect([blockAt(ROW, COL), blockAt(ROW, COL + 1)]).toEqual([true, true]);
                expect([texturesAt(ROW, COL), texturesAt(ROW, COL + 1)]).toEqual([TEXTURES, OTHER_TEXTURES]);
                expect([blockAt(ROW + 1, COL), blockAt(ROW + 3, COL), blockAt(ROW + 4, COL)])
                    .toEqual([false, false, false]);
                expect(room.dirty).toBe(false);
                const told = blockSignalsSentTo(users[1]);
                expect(told.add.length).toBe(2);
                expect([told.move, told.remove]).toEqual([[], []]);
            },
        });
    });

    it("answers a refused removal with what its cell holds, and takes a block once no canvas hangs on it", async () => {
        // A wall as wide and as tall as a canvas, with one covering the face that looks back towards the room.
        const WALL_ROW = 8;
        const WALL_COL = 8;
        const NUM_WALL_COLS = VOXELS_PER_WORLD_UNIT;
        const NUM_WALL_LAYERS = 2;
        const wall = wallBlocks(WALL_ROW, WALL_COL, NUM_WALL_COLS, NUM_WALL_LAYERS, TEXTURES);
        await runScenario({
            name: "removing a block that holds a canvas",
            rooms: [{ ...EMPTY_HUB, voxels: wall }],
            users: usersInRoom(2, "hub"),
            assertions: ({ users }) => {
                const sender = users[0];
                const room = hub();
                const canvas = new AddObjectSignal(room.id, sender.user.id, sender.user.userName,
                    ObjectTypeConfigMap.getIndexByType("Canvas"), "canvas-on-wall",
                    new ObjectTransform(wallFaceCenter(WALL_ROW, WALL_COL, NUM_WALL_COLS, NUM_WALL_LAYERS),
                        { x: 0, y: 0, z: -1 }, {...UNIT_VEC3}));
                expect(ObjectUpdateUtil.addObject(sender.user, room, canvas)).toBe(true);
                users[1].socketUserContext.clearAllPendingSignalsToUser();
                room.dirty = false;

                const remove = (row: number, col: number, layer: number) => answerTo(sender,
                    () => ServerVoxelManager.onRemoveVoxelBlockSignalReceived(sender.socketUserContext,
                        new RemoveVoxelBlockSignal(room.id, quadIndexAt(row, col, layer))));

                // Each block of the wall is part of what the canvas hangs on. The sender took it away on
                // their own screen, so they are told of it as it stands.
                for (const {row, col, layer} of wall)
                {
                    expect(remove(row, col, layer))
                        .toEqual({add: [[quadIndexAt(row, col, layer), TEXTURES]], remove: []});
                    expect(blockAt(row, col, layer)).toBe(true);
                }
                // Where no block stands there is none to take away, which is all there is to tell.
                expect(remove(ROW, COL, 0)).toEqual({add: [], remove: [quadIndexAt(ROW, COL)]});
                expect(room.dirty).toBe(false);
                expect(blockSignalsSentTo(users[1])).toEqual({add: [], remove: [], move: []});

                // With the canvas down, the wall is anybody's to take away.
                expect(ObjectUpdateUtil.removeObject(sender.user, room,
                    new RemoveObjectSignal(room.id, canvas.objectId))).toBe(true);
                room.dirty = false;
                for (const {row, col, layer} of wall)
                {
                    expect(remove(row, col, layer)).toEqual({add: [], remove: []});
                    expect(blockAt(row, col, layer)).toBe(false);
                }
                expect(room.dirty).toBe(true);
                const told = blockSignalsSentTo(users[1]);
                expect(told.remove.map(signal => signal.quadIndex))
                    .toEqual(wall.map(({row, col, layer}) => quadIndexAt(row, col, layer)));
                expect([told.add, told.move]).toEqual([[], []]);
            },
        });
    });

    it("keeps both depths of the wall behind a door, and answers with the blocks as they are", async () => {
        // A door rests on its wall two blocks deep (see DoorObjectTypeConfig): all the boundary wall has.
        const behindDoor = getWallBehindEntranceDoor();
        const [innerWallRow, outerWallRow] = behindDoor.rows;
        // The outermost column any part of the door lies before, and the one next to it, which holds nothing
        // up, as a control.
        const colBehindDoor = behindDoor.cols[0];
        const plainCol = colBehindDoor - 1;
        await runScenario({
            name: "the wall a door hangs on, at each depth",
            // (Seeding a block that stands already gives it its textures, which tell the two depths apart.)
            rooms: [{ ...EMPTY_HUB, voxels: [
                { row: innerWallRow, col: colBehindDoor, layer: 0, textures: TEXTURES },
                { row: outerWallRow, col: colBehindDoor, layer: 0, textures: OTHER_TEXTURES },
            ] }],
            users: usersInRoom(2, "hub"),
            actions: [
                { type: "removeVoxel", userIndex: 0, row: innerWallRow, col: colBehindDoor, layer: 0 },
                { type: "removeVoxel", userIndex: 0, row: outerWallRow, col: colBehindDoor, layer: 0 },
                { type: "removeVoxel", userIndex: 0, row: innerWallRow, col: plainCol, layer: 0 },
                { type: "removeVoxel", userIndex: 0, row: outerWallRow, col: plainCol, layer: 0 },
            ],
            assertions: ({ users }) => {
                expect([blockAt(innerWallRow, colBehindDoor), blockAt(outerWallRow, colBehindDoor)],
                    "the wall the room's door hangs on was taken out").toEqual([true, true]);
                expect([blockAt(innerWallRow, plainCol), blockAt(outerWallRow, plainCol)]).toEqual([false, false]);

                const answered = blockSignalsSentTo(users[0]);
                expect(answered.add.map(signal => [signal.quadIndex, signal.quadTextureIndicesWithinLayer])).toEqual([
                    [quadIndexAt(innerWallRow, colBehindDoor), TEXTURES],
                    [quadIndexAt(outerWallRow, colBehindDoor), OTHER_TEXTURES]]);
                expect([answered.remove, answered.move]).toEqual([[], []]);

                const told = blockSignalsSentTo(users[1]);
                expect(told.remove.map(signal => signal.quadIndex))
                    .toEqual([quadIndexAt(innerWallRow, plainCol), quadIndexAt(outerWallRow, plainCol)]);
                expect([told.add, told.move]).toEqual([[], []]);
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
        let pos: Vec3 = { x: ENTRANCE_DOOR_X, y: feetY + 0.5 * PLAYER_HEIGHT, z: startZ };
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
                const startZ = ENTRANCE_WALL_Z - 2.5;

                // At the entrance cell the player stops at the wall on either storey, with no invisible collider.
                const groundZ = walkTowardsEntrance(room, startZ, COLLISION_LAYER_MIN - 1);
                expect(groundZ).toBeLessThan(ENTRANCE_WALL_Z);

                const upperZ = walkTowardsEntrance(room, startZ, STOREY_FLOOR_COLLISION_LAYER);
                expect(upperZ).toBeLessThan(ENTRANCE_WALL_Z);
            },
        });
    });

    it("takes a wall attachment on the faces inside an opening cut through it", async () => {
        // An opening in the boundary wall has reveal walls within its thickness, so attachments on them are
        // the only ones positioned inside the boundary ring.
        // (The opening: a world unit along the wall, through all of its thickness, and a canvas tall.)
        const HOLE_Z = 8;
        const HOLE_ROWS = Array.from({length: VOXELS_PER_WORLD_UNIT},
            (_, i) => VoxelQueryUtil.getVoxelRowFromWorldZ(HOLE_Z) + i);
        const HOLE_COLS = voxelsThroughWall(0);
        const HOLE_LAYERS = [2, 3];
        const hole = HOLE_ROWS.flatMap(row => HOLE_COLS.flatMap(
            col => HOLE_LAYERS.map(layer => ({ row, col, layer }))));
        await runScenario({
            name: "an opening in the boundary wall",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            actions: hole.map(block => ({ type: "removeVoxel" as const, userIndex: 0, ...block })),
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
                const hangs = (pos: Vec3, dir: Vec3) => ObjectAttachmentUtil.canPlaceObject(
                    room, "attachment", canvasTypeIndex,
                    new ObjectTransform(pos, dir, {...UNIT_VEC3}));

                // The stretch the opening was cut through is gone from the wall...
                expect(hole.length).toBe(HOLE_ROWS.length * HOLE_COLS.length * HOLE_LAYERS.length);
                for (const {row, col, layer} of hole)
                {
                    const holed = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col)!;
                    expect(VoxelQueryUtil.isVoxelBlockPresent(holed, layer), `(${row}, ${col}, ${layer})`).toBe(false);
                }

                // ...and a picture hangs on either reveal, facing along the wall, at the opening's height.
                expect(hangs({ x: 0.5, y: 1.5, z: HOLE_Z }, { x: 0, y: 0, z: 1 })).toBe(true);
                expect(hangs({ x: 0.5, y: 1.5, z: HOLE_Z + 1 }, { x: 0, y: 0, z: -1 })).toBe(true);

                // Still refused: an attachment across the wall's inner face, half buried in the boundary...
                expect(hangs({ x: 1, y: 1.5, z: HOLE_Z }, { x: 0, y: 0, z: 1 })).toBe(false);
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
        // Two world units wide and two tall: room for a 1x1 canvas, not for a 2.5x2.5 one.
        const NUM_WALL_COLS = 2 * VOXELS_PER_WORLD_UNIT;
        const NUM_WALL_LAYERS = 4;
        await runScenario({
            name: "a resized canvas on a patch of wall",
            rooms: [{ ...EMPTY_HUB, voxels: wallBlocks(WALL_ROW, WALL_COL, NUM_WALL_COLS, NUM_WALL_LAYERS) }],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
                const middle = wallFaceCenter(WALL_ROW, WALL_COL, NUM_WALL_COLS, NUM_WALL_LAYERS);
                // Before the middle of the patch, standing on the floor whatever its size: a canvas the type's
                // own size would have its wall there, and the stretched one lacks only wall, not room.
                const hangsAtScale = (scale: number) => {
                    const height = ObjectScaleUtil.getObjectSize(canvasTypeIndex, {x: scale, y: scale, z: 1}).y;
                    return ObjectAttachmentUtil.canPlaceObject(room, "attachment", canvasTypeIndex,
                        new ObjectTransform({ ...middle, y: 0.5 * height },
                            { x: 0, y: 0, z: -1 }, {x: scale, y: scale, z: 1}));
                };

                expect(hangsAtScale(1)).toBe(true);
                expect(hangsAtScale(2.5)).toBe(false);
            },
        });
    });

    it("hangs a widened attachment that the wall does reach behind", async () => {
        const WALL_ROW = 8;
        const WALL_COL = 8;
        const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
        // A patch the largest canvas just covers, hung in its middle: exactly as tall, and a world unit wider.
        const largest = ObjectScaleUtil.getMaxObjectSize(canvasTypeIndex);
        const NUM_WALL_COLS = (Math.ceil(largest.x) + 1) * VOXELS_PER_WORLD_UNIT;
        const NUM_WALL_LAYERS = Math.ceil(largest.y / COLLISION_LAYER_HEIGHT);
        await runScenario({
            name: "a wide patch of wall",
            rooms: [{ ...EMPTY_HUB, voxels: wallBlocks(WALL_ROW, WALL_COL, NUM_WALL_COLS, NUM_WALL_LAYERS) }],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const canvasConfig = ObjectTypeConfigMap.getConfigByIndex(canvasTypeIndex);
                const hangsAtScale = (scale: number) => ObjectAttachmentUtil.canPlaceObject(
                    room, "attachment", canvasTypeIndex,
                    new ObjectTransform(wallFaceCenter(WALL_ROW, WALL_COL, NUM_WALL_COLS, NUM_WALL_LAYERS),
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
            expect(voxel.blockLayerMask).toBe((1 << NUM_COLLISION_LAYERS) - 1);

        const bufferState = EncodingUtil.startEncoding();
        voxelGrid.encode(bufferState);
        const bytes = new Uint8Array(EncodingUtil.endEncoding(bufferState));

        // Nothing was dropped on the way out...
        expect(bytes.length).toBeLessThanOrEqual(MAX_ENCODED_VOXEL_GRID_BYTES);

        // ...and the room that comes back is the room that went in.
        const reloaded = VoxelGrid.decode(new BufferState(bytes)) as VoxelGrid;
        expect(reloaded.voxels.length).toBe(NUM_VOXEL_ROWS * NUM_VOXEL_COLS);
        expect(reloaded.voxels.map(v => v.blockLayerMask))
            .toEqual(voxelGrid.voxels.map(v => v.blockLayerMask));
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
