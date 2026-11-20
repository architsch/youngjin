/**
 * Scenario tests: doors (the room superuser's world-building) — who may add, remove, move and edit them,
 * how their metadata is validated, the wall one needs behind it, and where arriving players spawn.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import { runScenario, VoxelPlacement } from "../helpers/scenarioRunner";
import { EMPTY_HUB, EMPTY_REGULAR, userAtCenter } from "../helpers/scenarioPresets";
import { getLooks } from "../helpers/composition";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import SpawnHotspotUtil from "../../../src/server/room/util/spawnHotspotUtil";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectMetadataEntryMap from "../../../src/shared/object/maps/objectMetadataEntryMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import DoorObjectTypeConfig, { ENTERING_SPEED, ENTERING_STRIDE_LENGTH, ENTRANCE_DIST_IN_FRONT_OF_DOOR,
    ENTRANCE_DOOR_OBJECT_ID, SPAWN_DIST_BEHIND_DOOR } from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import DoorEntranceUtil from "../../../src/shared/object/util/doorEntranceUtil";
import ObjectObstacleUtil from "../../../src/shared/object/util/objectObstacleUtil";
import VoxelPathUtil from "../../../src/shared/voxel/util/voxelPathUtil";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import LabelTextUtil from "../../../src/shared/object/util/labelTextUtil";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import { DoorTypeEnumMap } from "../../../src/shared/object/types/doorType";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import Room from "../../../src/shared/room/types/room";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import VoxelQuadsRuntimeMemory from "../../../src/shared/voxel/types/voxelQuadsRuntimeMemory";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import Vec3 from "../../../src/shared/math/types/vec3";
import ObjectAttachmentUtil from "../../../src/shared/object/util/objectAttachmentUtil";
import { COLLISION_LAYER_HEIGHT, GENERATED_WALL_THICKNESS, GRAVITY_SPEED,
    LABEL_COLOR_PALETTE_NAME, INITIAL_MULTI_PLAYER_ENTRANCE_POS, MAX_ROOM_X, MAX_ROOM_Z, NUM_COLLISION_LAYERS,
    NUM_VOXEL_COLS, NUM_VOXEL_ROWS, OBJECT_LABEL_MAX_LENGTH, SANDBOX_SINGLE_PLAYER_MODE, STOREY_FLOOR_COLLISION_LAYER,
    TUTORIAL_SINGLE_PLAYER_MODE, UNIT_VEC3, VOXEL_CELL_SIZE } from "../../../src/shared/system/sharedConstants";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";

const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");
const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
const DOOR_FOOTPRINT_WIDTH =
    DoorObjectTypeConfig.components.spawnedByAny.collider.baseHitboxSize.sizeX;
const DOOR_FOOTPRINT_HEIGHT =
    DoorObjectTypeConfig.components.spawnedByAny.collider.baseHitboxSize.sizeY;

function makeUser(id: string, userType: number, ownedRoomID: string = ""): User
{
    return new User(id, `User_${id}`, userType, `${id}@test.com`, "", "", ownedRoomID);
}

const ADMIN = makeUser("an-admin", UserTypeEnumMap.Admin);
const MEMBER = makeUser("a-member", UserTypeEnumMap.Member);
const GUEST = makeUser("a-guest", UserTypeEnumMap.Guest);
// Ownership is the user naming the room as their own.
const OWNER = makeUser("an-owner", UserTypeEnumMap.Member, "regular");

// A door on the boundary wall, well clear of the room's existing one.
function makeDoorSignal(room: Room, sourceUser: User, objectId: string = "new-door"): AddObjectSignal
{
    return new AddObjectSignal(room.id, sourceUser.id, sourceUser.userName, doorTypeIndex, objectId,
        new ObjectTransform(
            {
                x: INITIAL_MULTI_PLAYER_ENTRANCE_POS.x - 5,
                y: 0.5 * DOOR_FOOTPRINT_HEIGHT,
                z: INITIAL_MULTI_PLAYER_ENTRANCE_POS.z,
            },
            {x: 0, y: 0, z: -1}, {...UNIT_VEC3}));
}

function getEntranceDoor(room: Room): AddObjectSignal
{
    const door = room.objectById[ENTRANCE_DOOR_OBJECT_ID];
    expect(door, "the room came out with no way in").toBeDefined();
    return door;
}

describe("door permissions", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("lets an admin hang a door in a hub, and nobody else", async () => {
        await runScenario({
            name: "hanging a door in a hub",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const canAdd = (user: User) => ObjectUpdateUtil.canAddObject(user, room, makeDoorSignal(room, user));

                expect(canAdd(ADMIN)).toBe(true);
                expect(canAdd(MEMBER)).toBe(false);
                expect(canAdd(GUEST)).toBe(false);
            },
        });
    });

    it("lets a regular room's owner hang a door there, and nobody else, not even an admin", async () => {
        await runScenario({
            name: "hanging a door in a regular room",
            rooms: [EMPTY_REGULAR],
            users: [userAtCenter("regular")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["regular"].room;
                const canAdd = (user: User) => ObjectUpdateUtil.canAddObject(user, room, makeDoorSignal(room, user));

                expect(canAdd(OWNER)).toBe(true);
                for (const user of [ADMIN, MEMBER, GUEST])
                    expect(canAdd(user)).toBe(false);
            },
        });
    });

    it("lets anyone manage doors in the sandbox, but nobody in any other single-player room", () => {
        // The sandbox's player is its superuser, so door tools can be tried without a hub.
        const singlePlayerRoom = (name: string) => new Room(name, name, RoomTypeEnumMap.SinglePlayer, "", "",
            "default", "", new VoxelGrid([], new VoxelQuadsRuntimeMemory()), new ObjectGroup([]));
        const sandbox = singlePlayerRoom(SANDBOX_SINGLE_PLAYER_MODE);
        const tutorial = singlePlayerRoom(TUTORIAL_SINGLE_PLAYER_MODE);
        const canRemoveDoor = (user: User, room: Room) =>
            DoorObjectTypeConfig.canUserRemoveObject(user, room, makeDoorSignal(room, user));

        for (const user of [ADMIN, MEMBER, GUEST])
        {
            expect(canRemoveDoor(user, sandbox)).toBe(true);
            expect(canRemoveDoor(user, tutorial)).toBe(false);
        }
    });

    it("refuses a door hung under somebody else's name", async () => {
        await runScenario({
            name: "spoofed door",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const spoofed = makeDoorSignal(room, MEMBER);
                expect(ObjectUpdateUtil.canAddObject(ADMIN, room, spoofed))
                    .toBe(false);
            },
        });
    });

    it("lets only an admin take a hub's door down, move it, or re-wire it", async () => {
        await runScenario({
            name: "editing a hub's door",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const door = getEntranceDoor(room);

                const canRemove = (user: User) => ObjectUpdateUtil.canRemoveObject(user, room, new RemoveObjectSignal(room.id, door.objectId));
                const canMove = (user: User) => ObjectUpdateUtil.canSetObjectTransform(user, room, new SetObjectTransformSignal(room.id,
                        door.objectId, door.transform, true));
                const canRename = (user: User) => ObjectUpdateUtil.canSetObjectMetadata(user, room, new SetObjectMetadataSignal(room.id,
                        door.objectId, ObjectMetadataKeyEnumMap.Label, "Library"));

                expect(canRemove(ADMIN)).toBe(true);
                expect(canMove(ADMIN)).toBe(true);
                expect(canRename(ADMIN)).toBe(true);

                for (const user of [MEMBER, GUEST])
                {
                    expect(canRemove(user)).toBe(false);
                    expect(canMove(user)).toBe(false);
                    expect(canRename(user)).toBe(false);
                }
            },
        });
    });

    it("refuses a door move that would be resolved against physics", async () => {
        // Doors are placed via gizmo, not the physics-resolved motion path.
        await runScenario({
            name: "physical door move",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const door = getEntranceDoor(room);
                expect(ObjectUpdateUtil.canSetObjectTransform(ADMIN, room,
                    new SetObjectTransformSignal(room.id, door.objectId, door.transform, false)))
                    .toBe(false);
            },
        });
    });

    it("answers only to the metadata a door has", async () => {
        await runScenario({
            name: "door metadata whitelist",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const door = getEntranceDoor(room);
                const canSet = (key: number, value: string) =>
                    ObjectUpdateUtil.canSetObjectMetadata(ADMIN, room,
                        new SetObjectMetadataSignal(room.id, door.objectId, key, value));

                expect(canSet(ObjectMetadataKeyEnumMap.Label, "Library")).toBe(true);
                expect(canSet(ObjectMetadataKeyEnumMap.LabelColor, "3")).toBe(true);
                expect(canSet(ObjectMetadataKeyEnumMap.DestinationRoomId, "some-room")).toBe(true);
                expect(canSet(ObjectMetadataKeyEnumMap.DestinationDoorLabel, "Back Door")).toBe(true);
                expect(canSet(ObjectMetadataKeyEnumMap.DoorType,
                    `${DoorTypeEnumMap.DefaultEntrance}`)).toBe(true);
                expect(canSet(ObjectMetadataKeyEnumMap.InstancedMeshComposition, getLooks("Door")[1].stored)).toBe(true);
                // Only as one of its own finishes.
                expect(canSet(ObjectMetadataKeyEnumMap.InstancedMeshComposition, "abc")).toBe(false);

                // A door displays no picture and says nothing, so neither key means anything on one.
                expect(canSet(ObjectMetadataKeyEnumMap.ImagePath, "some/image.webp")).toBe(false);
                expect(canSet(ObjectMetadataKeyEnumMap.SentMessage, "hello")).toBe(false);
            },
        });
    });
});

describe("what a door makes of the values it is handed", () => {
    it("trims a label and cuts it to length, since a label is also a name to be found by", () => {
        const preprocess = (value: string) => ObjectMetadataEntryMap.preprocess(
            ObjectMetadataKeyEnumMap.Label, value);

        expect(preprocess("  Library  ")).toBe("Library");
        expect(preprocess("x".repeat(OBJECT_LABEL_MAX_LENGTH + 50)).length)
            .toBe(OBJECT_LABEL_MAX_LENGTH);
    });

    it("snaps a door type to one the enum actually holds", () => {
        const preprocess = (value: string) => ObjectMetadataEntryMap.preprocess(
            ObjectMetadataKeyEnumMap.DoorType, value);

        expect(preprocess(`${DoorTypeEnumMap.DefaultEntrance}`))
            .toBe(`${DoorTypeEnumMap.DefaultEntrance}`);
        expect(preprocess(`${DoorTypeEnumMap.CustomEntrance}`))
            .toBe(`${DoorTypeEnumMap.CustomEntrance}`);

        // A non-door type falls back to the safer kind (not offered as an arrival door).
        for (const nonsense of ["", "banana", "99", "-1", "1.5"])
            expect(preprocess(nonsense)).toBe(`${DoorTypeEnumMap.CustomEntrance}`);
    });

    it("keeps a label color inside the palette it is a position in", () => {
        const preprocess = (value: string) => ObjectMetadataEntryMap.preprocess(
            ObjectMetadataKeyEnumMap.LabelColor, value);
        const lastIndex = ColorUtil.getPaletteSize(LABEL_COLOR_PALETTE_NAME) - 1;

        expect(preprocess("0")).toBe("0");
        expect(preprocess(`${lastIndex}`)).toBe(`${lastIndex}`);

        // A position past either end names no color at all, so it is pulled back to one that does.
        expect(preprocess(`${lastIndex + 100}`)).toBe(`${lastIndex}`);
        expect(preprocess("-5")).toBe("0");
        for (const nonsense of ["", "banana"])
            expect(preprocess(nonsense)).toBe("0");
    });

    it("reads an unlettered door's ink as the color its type is lettered in", async () => {
        await runScenario({
            name: "default label color",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const door = getEntranceDoor(room);

                // Unset: the picker opens on the palette entry nearest the type's declared color, so
                // re-picking it changes nothing.
                const configuredHex = ObjectTypeConfigMap.getConfigByIndex(doorTypeIndex)
                    .components.spawnedByAny!.labelText!.defaultFontColorHex;
                expect(LabelTextUtil.getColorIndex(door)).toBe(
                    ColorUtil.rgbToPaletteIndex(LABEL_COLOR_PALETTE_NAME,
                        ColorUtil.hexToRGB(configuredHex)));

                door.metadata[ObjectMetadataKeyEnumMap.LabelColor] = new EncodableByteString("7");
                expect(LabelTextUtil.getColorIndex(door)).toBe(7);
            },
        });
    });

    it("reads a door with no metadata as a custom entrance leading nowhere", async () => {
        await runScenario({
            name: "a bare door",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const bare = makeDoorSignal(room, ADMIN);
                expect(LabelTextUtil.getText(bare)).toBe("");
                expect(DoorObjectTypeConfig.util.getDestinationRoomId(bare)).toBe("");
                expect(DoorObjectTypeConfig.util.getDestinationDoorLabel(bare)).toBe("");
                expect(DoorObjectTypeConfig.util.getDoorType(bare)).toBe(DoorTypeEnumMap.CustomEntrance);
            },
        });
    });
});

/**
 * The door a multiplayer room comes with (see DoorObjectTypeConfig.util.makeEntranceDoor), which generation
 * and the conversion of older rooms both hang by naming where its foot goes.
 */
describe("a room's own entrance door", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    // How far in from the room's edge a boundary wall's room-facing side lies.
    const WALL_DEPTH = GENERATED_WALL_THICKNESS * VOXEL_CELL_SIZE;
    const UPPER_FLOOR_Y = (STOREY_FLOOR_COLLISION_LAYER + 1) * COLLISION_LAYER_HEIGHT;

    // A foot on each boundary wall, well away from the corners, and one on the upper storey.
    const FEET = [
        {wall: "far z", foot: {x: 10.5, y: 0, z: MAX_ROOM_Z - WALL_DEPTH}, facing: {x: 0, y: 0, z: -1}},
        {wall: "near z", foot: {x: 10.5, y: 0, z: WALL_DEPTH}, facing: {x: 0, y: 0, z: 1}},
        {wall: "far x", foot: {x: MAX_ROOM_X - WALL_DEPTH, y: 0, z: 10.5}, facing: {x: -1, y: 0, z: 0}},
        {wall: "near x", foot: {x: WALL_DEPTH, y: 0, z: 10.5}, facing: {x: 1, y: 0, z: 0}},
        {wall: "near z, upstairs", foot: {x: 10.5, y: UPPER_FLOOR_Y, z: WALL_DEPTH}, facing: {x: 0, y: 0, z: 1}},
    ];

    it("stands with its foot where it is told, facing into the room from whichever wall that is", () => {
        for (const {wall, foot, facing} of FEET)
        {
            const door = DoorObjectTypeConfig.util.makeEntranceDoor("a-room", foot);
            expect(door.objectId, wall).toBe(ENTRANCE_DOOR_OBJECT_ID);
            expect(door.transform.pos, wall).toEqual({x: foot.x, y: foot.y + 0.5 * DOOR_FOOTPRINT_HEIGHT, z: foot.z});
            expect(door.transform.dir, wall).toEqual(facing);
        }
    });

    it("has the wall it needs behind it on every one of a room's boundary walls", async () => {
        await runScenario({
            name: "entrance doors round the boundary",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                room.objectGroup.removeObject(ENTRANCE_DOOR_OBJECT_ID);
                for (const {wall, foot} of FEET)
                {
                    const door = DoorObjectTypeConfig.util.makeEntranceDoor(room.id, foot);
                    expect(ObjectAttachmentUtil.canPlaceObject(room, door.objectId, door.objectTypeIndex,
                        door.transform), wall).toBe(true);

                    // Turned to face the other way it would look into its own wall, and has none behind it.
                    const turned = new ObjectTransform(door.transform.pos,
                        {x: -door.transform.dir.x, y: 0, z: -door.transform.dir.z}, door.transform.scale);
                    expect(ObjectAttachmentUtil.canPlaceObject(room, door.objectId, door.objectTypeIndex, turned),
                        `${wall}, turned round`).toBe(false);
                }
            },
        });
    });
});

/**
 * Moving a door vertically: a door is an odd number of layers tall, so its center is off-grid; the
 * bottom edge is snapped instead (snapping the center would float it a quarter layer).
 */
describe("placing a door on its wall", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("stands it with its foot on a layer boundary, clear of the slab and never below the floor", async () => {
        await runScenario({
            name: "door vertical placement",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const door = getEntranceDoor(room);
                const spawnedY = door.transform.pos.y;
                const placeAt = (y: number) => ObjectAttachmentUtil.findPlacement(room, doorTypeIndex,
                    {...door.transform.pos, y}, door.transform.dir, door.transform.scale,
                    (tr) => ObjectAttachmentUtil.canPlaceObject(room, door.objectId, doorTypeIndex, tr));

                // As generated: on the floor, center half a footprint up.
                expect(spawnedY).toBeCloseTo(0.5 * DOOR_FOOTPRINT_HEIGHT, 6);

                // Asked for a little off the grid, the foot lands exactly on a layer boundary.
                for (const offset of [0.1, -0.1, 0.2])
                    expect(placeAt(spawnedY + offset)!.pos.y).toBeCloseTo(spawnedY, 6);

                // A layer up is allowed, but a storey-tall door's top would then run into the storey slab,
                // so a drag prefers to keep its face clear and leaves it standing on the floor.
                const layerUp = new ObjectTransform({...door.transform.pos, y: spawnedY + COLLISION_LAYER_HEIGHT},
                    door.transform.dir, door.transform.scale);
                expect(ObjectAttachmentUtil.canPlaceObject(room, door.objectId, doorTypeIndex, layerUp)).toBe(true);
                expect(placeAt(spawnedY + COLLISION_LAYER_HEIGHT)!.pos.y).toBeCloseTo(spawnedY, 6);

                // Never below the floor, which the wall runs on beneath (see ObjectAttachmentUtil).
                expect(ObjectAttachmentUtil.canPlaceObject(room, door.objectId, doorTypeIndex,
                    new ObjectTransform({...door.transform.pos, y: spawnedY - COLLISION_LAYER_HEIGHT},
                        door.transform.dir, door.transform.scale))).toBe(false);
                expect(placeAt(spawnedY - 0.2)!.pos.y).toBeCloseTo(spawnedY, 6);
            },
        });
    });
});

describe("the wall a door needs", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    // Two walls standing free in the room from its floor to the storey's slab, each with its face at its z,
    // looking toward -z: one a single block deep, the other three. Both reach a world unit or more past a door
    // hung about x = DOOR_X, on either side of it.
    const DOOR_X = 8.5;
    const THIN_WALL_Z = 20;
    const THICK_WALL_Z = 10;
    const THICK_WALL_DEPTH_IN_BLOCKS = 3;
    const WALL_HALF_WIDTH = Math.ceil(0.5 * DOOR_FOOTPRINT_WIDTH) + 1;
    const SLAB_BOTTOM_Y = STOREY_FLOOR_COLLISION_LAYER * COLLISION_LAYER_HEIGHT;
    const FACING: Vec3 = {x: 0, y: 0, z: -1};

    // The blocks a box of the room reaches into, wholly or in part, given in world units.
    function blocksIn(min: Vec3, max: Vec3): VoxelPlacement[]
    {
        // Measured just inside the box, so that a side lying on a block boundary takes in nothing beyond it.
        const inset = 0.001;
        const {getVoxelRowFromWorldZ: rowAt, getVoxelColFromWorldX: colAt,
            getVoxelCollisionLayerFromWorldY: layerAt} = VoxelQueryUtil;
        const blocks: VoxelPlacement[] = [];
        for (let row = rowAt(min.z + inset); row <= rowAt(max.z - inset); ++row)
        {
            for (let col = colAt(min.x + inset); col <= colAt(max.x - inset); ++col)
            {
                for (let layer = layerAt(min.y + inset); layer <= layerAt(max.y - inset); ++layer)
                    blocks.push({row, col, layer});
            }
        }
        return blocks;
    }

    const wallAt = (z: number, depthInBlocks: number, height: number = SLAB_BOTTOM_Y) => blocksIn(
        {x: DOOR_X - WALL_HALF_WIDTH, y: 0, z},
        {x: DOOR_X + WALL_HALF_WIDTH, y: height, z: z + depthInBlocks * VOXEL_CELL_SIZE});
    const WALLED_HUB = {...EMPTY_HUB,
        voxels: [...wallAt(THIN_WALL_Z, 1), ...wallAt(THICK_WALL_Z, THICK_WALL_DEPTH_IN_BLOCKS)]};
    // The thick wall and the slab over it: the blocks a door on that wall needs, and others beside them, above
    // them and behind them.
    const AROUND_THICK_WALL = wallAt(THICK_WALL_Z, THICK_WALL_DEPTH_IN_BLOCKS,
        SLAB_BOTTOM_Y + COLLISION_LAYER_HEIGHT);

    // Where a door stands on a wall with its middle at x, and the thick wall's blocks right behind it there.
    const doorPosOn = (wallZ: number, x: number = DOOR_X): Vec3 => ({x, y: 0.5 * DOOR_FOOTPRINT_HEIGHT, z: wallZ});
    const behindDoor = (x: number) => blocksIn(
        {x: x - 0.5 * DOOR_FOOTPRINT_WIDTH, y: 0, z: THICK_WALL_Z},
        {x: x + 0.5 * DOOR_FOOTPRINT_WIDTH, y: DOOR_FOOTPRINT_HEIGHT, z: THICK_WALL_Z + VOXEL_CELL_SIZE});
    const quadOf = (block: VoxelPlacement) =>
        VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(block.row, block.col, block.layer);

    it("is solid right behind all of it, and no deeper than a picture's", async () => {
        await runScenario({
            name: "door on a thick wall and a thin one",
            rooms: [WALLED_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const voxels = room.voxelGrid.voxels;
                const fits = (objectTypeIndex: number, pos: Vec3) => ObjectAttachmentUtil.canPlaceObject(room,
                    "candidate", objectTypeIndex, new ObjectTransform(pos, FACING, {...UNIT_VEC3}));

                // Hung about the line between two voxels, as a room's own way in is, a door lies over half
                // of the voxel at either end of it; hung about a voxel's middle, over whole ones alone.
                for (const doorX of [DOOR_X, DOOR_X + 0.5 * VOXEL_CELL_SIZE])
                {
                    const doorFits = () => fits(doorTypeIndex, doorPosOn(THICK_WALL_Z, doorX));
                    const needed = new Set(behindDoor(doorX).map(quadOf));
                    expect(doorFits(), `door at x ${doorX}`).toBe(true);

                    // Each block right behind any of it has to be there; no other has, the ones further in
                    // included.
                    for (const block of AROUND_THICK_WALL)
                    {
                        VoxelUpdateUtil.removeVoxelBlock(undefined, voxels, quadOf(block));
                        expect(doorFits(), `door at x ${doorX}, without ${JSON.stringify(block)}`)
                            .toBe(!needed.has(quadOf(block)));
                        VoxelUpdateUtil.addVoxelBlock(undefined, voxels, quadOf(block));
                    }
                }

                // A wall one block deep holds a door as it holds a picture.
                expect(fits(canvasTypeIndex, {x: DOOR_X, y: 1, z: THIN_WALL_Z})).toBe(true);
                expect(fits(doorTypeIndex, doorPosOn(THIN_WALL_Z))).toBe(true);
            },
        });
    });

    it("keeps every block the door rests on, and lets any other go", async () => {
        await runScenario({
            name: "blocks under a door",
            rooms: [WALLED_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const door = new AddObjectSignal(room.id, ADMIN.id, ADMIN.userName, doorTypeIndex, "wall-door",
                    new ObjectTransform(doorPosOn(THICK_WALL_Z), FACING, {...UNIT_VEC3}));
                expect(ObjectUpdateUtil.addObject(ADMIN, room, door)).toBe(true);

                const restedOn = new Set(behindDoor(DOOR_X).map(quadOf));
                for (const block of AROUND_THICK_WALL)
                {
                    const quadIndex = quadOf(block);
                    const where = JSON.stringify(block);
                    expect(ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex), where)
                        .toEqual(restedOn.has(quadIndex) ? [door.objectId] : []);
                    expect(VoxelUpdateUtil.canRemoveVoxelBlock(ADMIN, room, quadIndex), where)
                        .toBe(!restedOn.has(quadIndex));
                }
            },
        });
    });

    it("lets whoever arrives behind it walk out in front of it, however thin", async () => {
        await runScenario({
            name: "arriving through a door on a thin wall and a thick one",
            rooms: [WALLED_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
                const stride = SPAWN_DIST_BEHIND_DOOR + ENTRANCE_DIST_IN_FRONT_OF_DOOR;
                const deltaTime = 1 / 60;

                for (const wallZ of [THIN_WALL_Z, THICK_WALL_Z])
                {
                    const label = `Door at ${wallZ}`;
                    expect(ObjectUpdateUtil.addObject(ADMIN, room, new AddObjectSignal(room.id, ADMIN.id,
                        ADMIN.userName, doorTypeIndex, label, new ObjectTransform(doorPosOn(wallZ), FACING, {...UNIT_VEC3}),
                        {[ObjectMetadataKeyEnumMap.Label]: new EncodableByteString(label)}))).toBe(true);

                    // Put down behind the door, then walked forward for a second through the real physics, as
                    // PlayerController walks him: he looks the opposite way to his transform's direction.
                    const spawn = SpawnHotspotUtil.pickSpawnTransform(room, label);
                    let pos = {...spawn.pos};
                    PhysicsManager.addObject(room.id, "arrival", playerTypeIndex, PhysicsColliderStateUtil
                        .getObjectColliderState(playerTypeIndex, new ObjectTransform(pos, spawn.dir, {...UNIT_VEC3}))!);
                    for (let frame = 0; frame < 60 && Math.abs(pos.z - spawn.pos.z) < stride; ++frame)
                    {
                        const velocity = PhysicsManager.getAdjustedVelocity(room.id, "arrival",
                            {x: -3 * spawn.dir.x, y: -GRAVITY_SPEED, z: -3 * spawn.dir.z});
                        pos = PhysicsManager.setObjectTransform(room.id, "arrival", new ObjectTransform(
                            {x: pos.x + velocity.x * deltaTime, y: pos.y + velocity.y * deltaTime,
                                z: pos.z + velocity.z * deltaTime}, spawn.dir, {...UNIT_VEC3}), false).transform.pos;
                    }
                    PhysicsManager.removeObject(room.id, "arrival");

                    // Clear of the wall, on the side the door faces.
                    expect((pos.z - wallZ) * FACING.z, label).toBeGreaterThan(PLAYER_RADIUS_XZ);
                }
            },
        });
    });
});

/**
 * An arrival whose walk out of the doorway would end where something solid stands: put down instead on the nearest spot
 * in front of the door where a body stands clear, to walk nowhere.
 */
describe("arriving through a doorway something solid fills", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
    const cannonTypeIndex = ObjectTypeConfigMap.getIndexByType("Cannon");
    // The cells the room's own way in looks out on, as a generated room has it: its face on the boundary wall's inner
    // side, facing north, and the door's middle on the line between two columns.
    const FACE_ROW = INITIAL_MULTI_PLAYER_ENTRANCE_POS.z / VOXEL_CELL_SIZE;
    const DOOR_COL = INITIAL_MULTI_PLAYER_ENTRANCE_POS.x / VOXEL_CELL_SIZE;
    const LOWER_STOREY: [number, number] = [0, STOREY_FLOOR_COLLISION_LAYER - 1];

    type CellRange = [number, number];

    // Blocks in every cell of a box, set straight into the room's grid; undone by putting back what was there.
    function fill(room: Room, rows: CellRange, cols: CellRange, layers: CellRange): () => void
    {
        const kept = room.voxelGrid.voxels.map(voxel => voxel.blockLayerMask);
        for (let row = rows[0]; row <= rows[1]; ++row)
        {
            for (let col = cols[0]; col <= cols[1]; ++col)
            {
                for (let layer = layers[0]; layer <= layers[1]; ++layer)
                    room.voxelGrid.voxels[row * NUM_VOXEL_COLS + col].blockLayerMask |= 1 << layer;
            }
        }
        return () => room.voxelGrid.voxels.forEach((voxel, i) => { voxel.blockLayerMask = kept[i]; });
    }

    // Whether a body with its middle there reaches into a block, past the room's sides, or into a solid object, as the
    // physics finds it.
    function meetsSolid(room: Room, center: Vec3): boolean
    {
        const inset = 0.001;
        return PhysicsColliderStateUtil.boxOverlapsHardCollider(PhysicsManager.physicsRooms[room.id], {center,
            halfSize: {x: PLAYER_RADIUS_XZ - inset, y: 0.5 * PLAYER_HEIGHT - inset, z: PLAYER_RADIUS_XZ - inset}});
    }

    // Where the feet of a body walking out of the door end up, along the way it faces.
    function walkEndFeet(door: AddObjectSignal): Vec3
    {
        return {x: door.transform.pos.x + door.transform.dir.x * ENTRANCE_DIST_IN_FRONT_OF_DOOR,
            y: DoorObjectTypeConfig.util.getFloorY(door),
            z: door.transform.pos.z + door.transform.dir.z * ENTRANCE_DIST_IN_FRONT_OF_DOOR};
    }

    // How far in front of the door's face a point is.
    function inFront(door: AddObjectSignal, point: Vec3): number
    {
        return (point.x - door.transform.pos.x) * door.transform.dir.x + (point.z - door.transform.pos.z) * door.transform.dir.z;
    }

    // The distance from where the walk out ends to the nearest vertex a body stands on clear, wholly in front of the
    // door, found by trying every vertex of the room.
    function nearestOpenInFront(room: Room, door: AddObjectSignal): number
    {
        const isOpen = ObjectObstacleUtil.getClearance(room.objectById);
        const end = walkEndFeet(door);
        let nearest = Infinity;
        for (let layer = 0; layer < NUM_COLLISION_LAYERS; ++layer)
        {
            for (let row = 0; row <= NUM_VOXEL_ROWS; ++row)
            {
                for (let col = 0; col <= NUM_VOXEL_COLS; ++col)
                {
                    const vertex = {row, col, layer};
                    const at = VoxelPathUtil.toWorld(vertex);
                    if (inFront(door, at) >= PLAYER_RADIUS_XZ && VoxelPathUtil.isStandable(room.voxelGrid.voxels, vertex)
                        && isOpen(vertex))
                    {
                        nearest = Math.min(nearest, Math.hypot(at.x - end.x, at.y - end.y, at.z - end.z));
                    }
                }
            }
        }
        return nearest;
    }

    // Where a door puts an arrival whose walk out ends clear.
    function behindDoor(door: AddObjectSignal): ObjectTransform
    {
        const {pos, dir} = door.transform;
        return new ObjectTransform({x: pos.x - dir.x * SPAWN_DIST_BEHIND_DOOR,
            y: DoorObjectTypeConfig.util.getFloorY(door) + 0.5 * PLAYER_HEIGHT, z: pos.z - dir.z * SPAWN_DIST_BEHIND_DOOR},
            {x: -dir.x, y: 0, z: -dir.z}, {...UNIT_VEC3});
    }

    // Where a body put down behind the door gets to in a second of walking out through the real physics, as
    // PlayerController walks him.
    function walkOut(room: Room, spawn: ObjectTransform): Vec3
    {
        const deltaTime = 1 / 60;
        let pos = {...spawn.pos};
        PhysicsManager.addObject(room.id, "arrival", playerTypeIndex, PhysicsColliderStateUtil
            .getObjectColliderState(playerTypeIndex, new ObjectTransform(pos, spawn.dir, {...UNIT_VEC3}))!);
        for (let frame = 0; frame < 60 && Math.hypot(pos.x - spawn.pos.x, pos.z - spawn.pos.z) < ENTERING_STRIDE_LENGTH;
            ++frame)
        {
            const velocity = PhysicsManager.getAdjustedVelocity(room.id, "arrival",
                {x: -ENTERING_SPEED * spawn.dir.x, y: -GRAVITY_SPEED, z: -ENTERING_SPEED * spawn.dir.z});
            pos = PhysicsManager.setObjectTransform(room.id, "arrival", new ObjectTransform(
                {x: pos.x + velocity.x * deltaTime, y: pos.y + velocity.y * deltaTime,
                    z: pos.z + velocity.z * deltaTime}, spawn.dir, {...UNIT_VEC3}), false).transform.pos;
        }
        PhysicsManager.removeObject(room.id, "arrival");
        return pos;
    }

    // Put down where nothing is in his way, the nearest such spot in front of the door, facing as he would have walked
    // out, with no door he stands behind to walk out of.
    function expectPutDownInFront(room: Room, door: AddObjectSignal, spawn: ObjectTransform): void
    {
        const feet = VoxelPathUtil.feetOf(spawn.pos);
        const vertex = VoxelPathUtil.toVertex(feet);
        expect(vertex, JSON.stringify(spawn.pos)).toBeDefined();
        expect(VoxelPathUtil.isStandable(room.voxelGrid.voxels, vertex!)).toBe(true);
        expect(meetsSolid(room, spawn.pos)).toBe(false);
        expect(inFront(door, feet)).toBeGreaterThanOrEqual(PLAYER_RADIUS_XZ);
        const end = walkEndFeet(door);
        expect(Math.hypot(feet.x - end.x, feet.y - end.y, feet.z - end.z)).toBeCloseTo(nearestOpenInFront(room, door), 6);
        expect(spawn.dir).toEqual({x: -door.transform.dir.x, y: 0, z: -door.transform.dir.z});
        expect(DoorEntranceUtil.findDoorBehind(room, spawn.pos)).toBeUndefined();
    }

    function expectPutDownBehind(room: Room, door: AddObjectSignal, spawn: ObjectTransform): void
    {
        expect(DoorEntranceUtil.findDoorBehind(room, spawn.pos)).toBe(door);
        expect(inFront(door, spawn.pos)).toBeCloseTo(-SPAWN_DIST_BEHIND_DOOR, 6);
        // And his walk out gets him clear of the wall, into the room.
        expect(inFront(door, walkOut(room, spawn))).toBeGreaterThan(PLAYER_RADIUS_XZ);
    }

    function scenario(assertions: (room: Room, door: AddObjectSignal) => void): Promise<unknown>
    {
        return runScenario({
            name: "a doorway with something in it",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                assertions(room, getEntranceDoor(room));
            },
        });
    }

    it("keeps putting him behind the door while his walk out ends clear, however near the blocks come", async () => {
        await scenario((room, door) => {
            // Either side of the doorway, over his head and just past where he ends up.
            fill(room, [FACE_ROW - 1, FACE_ROW - 1], [DOOR_COL - 2, DOOR_COL - 2], LOWER_STOREY);
            fill(room, [FACE_ROW - 1, FACE_ROW - 1], [DOOR_COL + 1, DOOR_COL + 1], LOWER_STOREY);
            fill(room, [FACE_ROW - 2, FACE_ROW - 1], [DOOR_COL - 1, DOOR_COL],
                [PLAYER_HEIGHT / COLLISION_LAYER_HEIGHT, STOREY_FLOOR_COLLISION_LAYER - 1]);
            fill(room, [FACE_ROW - 6, FACE_ROW - 3], [DOOR_COL - 6, DOOR_COL + 5], LOWER_STOREY);
            expectPutDownBehind(room, door, SpawnHotspotUtil.pickSpawnTransform(room, ""));
        });
    });

    it("puts him past blocks filling the doorway, on the nearest spot in front of the door where he stands clear",
        async () => {
        await scenario((room, door) => {
            fill(room, [FACE_ROW - 4, FACE_ROW - 1], [DOOR_COL - 5, DOOR_COL + 5], LOWER_STOREY);
            const spawn = SpawnHotspotUtil.pickSpawnTransform(room, "");
            expectPutDownInFront(room, door, spawn);
            // Straight on, on the floor just past them.
            expect(VoxelPathUtil.toVertex(VoxelPathUtil.feetOf(spawn.pos)))
                .toEqual({row: FACE_ROW - 5, col: DOOR_COL, layer: 0});
        });
    });

    it("puts him beside a block at his feet, which he couldn't step up onto from inside the wall", async () => {
        await scenario((room, door) => {
            fill(room, [FACE_ROW - 1, FACE_ROW - 1], [DOOR_COL, DOOR_COL], [0, 0]);
            expectPutDownInFront(room, door, SpawnHotspotUtil.pickSpawnTransform(room, ""));
            // Walking out from behind the door would have left him in the wall.
            expect(inFront(door, walkOut(room, behindDoor(door)))).toBeLessThan(PLAYER_RADIUS_XZ);
        });
    });

    it("puts him up on the storey above when that is the nearest spot clear", async () => {
        await scenario((room, door) => {
            const walls = GENERATED_WALL_THICKNESS;
            fill(room, [NUM_VOXEL_ROWS / 2, FACE_ROW - 1], [walls, NUM_VOXEL_COLS - 1 - walls], LOWER_STOREY);
            const spawn = SpawnHotspotUtil.pickSpawnTransform(room, "");
            expectPutDownInFront(room, door, spawn);
            expect(VoxelPathUtil.feetOf(spawn.pos).y).toBeCloseTo((STOREY_FLOOR_COLLISION_LAYER + 1) * COLLISION_LAYER_HEIGHT, 6);
        });
    });

    it("keeps him off a cannon standing in the doorway", async () => {
        await scenario((room, door) => {
            const cannon = new AddObjectSignal(room.id, ADMIN.id, ADMIN.userName, cannonTypeIndex, "a-cannon",
                new ObjectTransform({x: door.transform.pos.x, y: 0, z: door.transform.pos.z - 0.75}, {x: 0, y: 1, z: 0},
                    {...UNIT_VEC3}));
            expect(ObjectUpdateUtil.addObject(ADMIN, room, cannon, false)).toBe(true);
            expect(PhysicsManager.hasObject(room.id, cannon.objectId)).toBe(true);
            const spawn = SpawnHotspotUtil.pickSpawnTransform(room, "");
            expectPutDownInFront(room, door, spawn);
        });
    });

    it("puts him wherever in front of the door the room leaves room for him, and behind it otherwise", async () => {
        await scenario((room, door) => {
            const box = fc.tuple(fc.integer({min: FACE_ROW - 8, max: FACE_ROW - 1}), fc.integer({min: 0, max: 4}),
                fc.integer({min: DOOR_COL - 6, max: DOOR_COL + 5}), fc.integer({min: 0, max: 4}),
                fc.integer({min: 0, max: STOREY_FLOOR_COLLISION_LAYER - 1}), fc.integer({min: 0, max: 5}));
            fc.assert(fc.property(fc.array(box, {minLength: 1, maxLength: 4}), boxes => {
                const undo = boxes.map(([row, rows, col, cols, layer, layers]) => fill(room,
                    [Math.max(0, row - rows), row], [col, col + cols], [layer, Math.min(STOREY_FLOOR_COLLISION_LAYER - 1,
                        layer + layers)]));
                try
                {
                    const spawn = SpawnHotspotUtil.pickSpawnTransform(room, "");
                    if (DoorEntranceUtil.findDoorBehind(room, spawn.pos) != undefined)
                        expectPutDownBehind(room, door, spawn);
                    else
                        expectPutDownInFront(room, door, spawn);
                }
                finally
                {
                    undo[0]();
                }
            }), {numRuns: 40});
        });
    });

    it("puts him anywhere in the room nothing fills when nothing in front of the door will do, and behind it when " +
        "nothing anywhere will", async () => {
        await scenario((room, door) => {
            const walls = GENERATED_WALL_THICKNESS;
            const inside: CellRange[] = [[walls, NUM_VOXEL_ROWS - 1 - walls], [walls, NUM_VOXEL_COLS - 1 - walls]];
            // A wall across the room's middle, both storeys, with a door on its south side looking out on all that is
            // filled.
            const middle = NUM_VOXEL_ROWS / 2;
            fill(room, [middle - 2, middle - 1], inside[1], [0, NUM_COLLISION_LAYERS - 1]);
            const inner = new AddObjectSignal(room.id, ADMIN.id, ADMIN.userName, doorTypeIndex, "inner-door",
                new ObjectTransform({x: door.transform.pos.x, y: 0.5 * DOOR_FOOTPRINT_HEIGHT, z: middle * VOXEL_CELL_SIZE},
                    {x: 0, y: 0, z: 1}, {...UNIT_VEC3}), {[ObjectMetadataKeyEnumMap.Label]: new EncodableByteString("Inner")});
            expect(ObjectUpdateUtil.addObject(ADMIN, room, inner)).toBe(true);
            const undoSouth = fill(room, [middle, inside[0][1]], inside[1], [0, NUM_COLLISION_LAYERS - 1]);

            const spawn = SpawnHotspotUtil.pickSpawnTransform(room, "Inner");
            expect(DoorEntranceUtil.findDoorBehind(room, spawn.pos)).toBeUndefined();
            expect(VoxelPathUtil.isStandable(room.voxelGrid.voxels, VoxelPathUtil.toVertex(VoxelPathUtil.feetOf(spawn.pos))!))
                .toBe(true);
            expect(meetsSolid(room, spawn.pos)).toBe(false);
            expect(inFront(inner, spawn.pos)).toBeLessThan(0);

            undoSouth();
            fill(room, inside[0], inside[1], [0, NUM_COLLISION_LAYERS - 1]);
            const nowhere = SpawnHotspotUtil.pickSpawnTransform(room, "Inner");
            expect(DoorEntranceUtil.findDoorBehind(room, nowhere.pos)).toBe(inner);
        });
    });
});

/**
 * Arrival spawn: the named door, else any entrance door, else any door, else the room itself.
 */
describe("choosing where a player arrives", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    // Another door on the entrance's wall, at the given x.
    function addDoor(room: Room, objectId: string, x: number, label: string, doorType: number)
    {
        const door = DoorObjectTypeConfig.util.makeEntranceDoor(room.id, {...INITIAL_MULTI_PLAYER_ENTRANCE_POS, x});
        door.objectId = objectId;
        door.metadata[ObjectMetadataKeyEnumMap.Label] = new EncodableByteString(label);
        door.metadata[ObjectMetadataKeyEnumMap.DoorType] = new EncodableByteString(`${doorType}`);
        room.objectGroup.addObject(door);
        return door;
    }

    it("puts him behind the door he was sent to, wherever that door is", async () => {
        await runScenario({
            name: "named destination door",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const named = addDoor(room, "side-door", 6.5, "Side Door",
                    DoorTypeEnumMap.CustomEntrance);

                const {pos, dir} = SpawnHotspotUtil.pickSpawnTransform(room, "Side Door");

                // Behind the door (inside its wall), on its floor, facing into the room; the entrance
                // stride carries the player through.
                expect(pos.x).toBeCloseTo(named.transform.pos.x, 3);
                expect(pos.z).toBeCloseTo(named.transform.pos.z + SPAWN_DIST_BEHIND_DOOR, 3);
                expect(dir.z).toBeCloseTo(1, 3);
            },
        });
    });

    it("finds a door by its name as read, whatever line breaks and spacing its plate is lettered with", async () => {
        await runScenario({
            name: "multiline destination door",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const named = addDoor(room, "side-door", 6.5, "Side\nDoor", DoorTypeEnumMap.CustomEntrance);

                for (const destination of ["Side Door", " Side  Door "])
                {
                    expect(SpawnHotspotUtil.pickSpawnTransform(room, destination).pos.x, destination)
                        .toBeCloseTo(named.transform.pos.x, 3);
                }
                // A destination that reads as nothing names no door, not every unlettered one.
                expect(SpawnHotspotUtil.pickSpawnTransform(room, " \n ").pos.x)
                    .toBeCloseTo(getEntranceDoor(room).transform.pos.x, 3);
            },
        });
    });

    it("falls back on the room's own way in when the named door is not there", async () => {
        await runScenario({
            name: "unknown destination door",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const entrance = getEntranceDoor(room);

                const {pos} = SpawnHotspotUtil.pickSpawnTransform(room, "A Door Nobody Hung");
                expect(pos.x).toBeCloseTo(entrance.transform.pos.x, 3);
            },
        });
    });

    it("falls back on any door at all when no door offers itself as the way in", async () => {
        await runScenario({
            name: "no default entrance",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                room.objectGroup.removeObject(ENTRANCE_DOOR_OBJECT_ID);
                const custom = addDoor(room, "side-door", 6.5, "", DoorTypeEnumMap.CustomEntrance);

                const {pos} = SpawnHotspotUtil.pickSpawnTransform(room, "");
                expect(pos.x).toBeCloseTo(custom.transform.pos.x, 3);
            },
        });
    });

    it("falls back on the middle of the room when it holds no door at all", async () => {
        await runScenario({
            name: "no doors",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                for (const objectId of Object.keys(room.objectById))
                {
                    if (room.objectById[objectId].objectTypeIndex === doorTypeIndex)
                        room.objectGroup.removeObject(objectId);
                }

                const {pos} = SpawnHotspotUtil.pickSpawnTransform(room, "");
                expect(pos.x).toBeCloseTo(0.5 * MAX_ROOM_X, 3);
                expect(pos.z).toBeCloseTo(0.5 * MAX_ROOM_Z, 3);
            },
        });
    });

    it("prefers a door that offers itself as the way in over one that does not", async () => {
        await runScenario({
            name: "default over custom",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const entrance = getEntranceDoor(room);
                addDoor(room, "side-door", 6.5, "", DoorTypeEnumMap.CustomEntrance);

                // Picked at random among equals, so repeated to show the custom door is never chosen.
                for (let attempt = 0; attempt < 20; ++attempt)
                {
                    const {pos} = SpawnHotspotUtil.pickSpawnTransform(room, "");
                    expect(pos.x).toBeCloseTo(entrance.transform.pos.x, 3);
                }
            },
        });
    });
});
