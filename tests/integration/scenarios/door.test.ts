/**
 * Scenario tests: doors (the room superuser's world-building) — who may add, remove, move and edit them,
 * how their metadata is validated, how deep a wall one needs behind it, and where arriving players spawn.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario, VoxelPlacement } from "../helpers/scenarioRunner";
import { EMPTY_HUB, EMPTY_REGULAR, userAtCenter } from "../helpers/scenarioPresets";
import { getLooks } from "../helpers/composition";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import SpawnHotspotUtil from "../../../src/server/room/util/spawnHotspotUtil";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectMetadataEntryMap from "../../../src/shared/object/maps/objectMetadataEntryMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import DoorObjectTypeConfig, { ENTRANCE_DOOR_OBJECT_ID,
    SPAWN_DIST_BEHIND_DOOR } from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
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
import { COLLISION_LAYER_HEIGHT, GENERATED_WALL_THICKNESS,
    LABEL_COLOR_PALETTE_NAME, INITIAL_MULTI_PLAYER_ENTRANCE_POS, MAX_ROOM_X, MAX_ROOM_Z, OBJECT_LABEL_MAX_LENGTH,
    SANDBOX_SINGLE_PLAYER_MODE, STOREY_FLOOR_COLLISION_LAYER, TUTORIAL_SINGLE_PLAYER_MODE, UNIT_VEC3,
    VOXEL_CELL_SIZE } from "../../../src/shared/system/sharedConstants";
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
    // looking toward -z: one a single block deep, the other a block deeper than a door needs. Both reach a
    // world unit or more past a door hung about x = DOOR_X, on either side of it.
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
    // The thick wall and the slab over it: the blocks a door on that wall needs, and others beside it, above
    // it and beyond the depth it needs.
    const AROUND_THICK_WALL = wallAt(THICK_WALL_Z, THICK_WALL_DEPTH_IN_BLOCKS,
        SLAB_BOTTOM_Y + COLLISION_LAYER_HEIGHT);

    // Where a door stands on a wall with its middle at x, and the thick wall's blocks behind it there: those
    // right behind its face (depth 0), or so many further in.
    const doorPosOn = (wallZ: number, x: number = DOOR_X): Vec3 => ({x, y: 0.5 * DOOR_FOOTPRINT_HEIGHT, z: wallZ});
    const behindDoor = (x: number, depth: number) => blocksIn(
        {x: x - 0.5 * DOOR_FOOTPRINT_WIDTH, y: 0, z: THICK_WALL_Z + depth * VOXEL_CELL_SIZE},
        {x: x + 0.5 * DOOR_FOOTPRINT_WIDTH, y: DOOR_FOOTPRINT_HEIGHT, z: THICK_WALL_Z + (depth + 1) * VOXEL_CELL_SIZE});
    const quadOf = (block: VoxelPlacement) =>
        VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(block.row, block.col, block.layer);

    it("is solid two blocks deep behind all of it, since arrivals stand inside the wall", async () => {
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
                    const needed = new Set([...behindDoor(doorX, 0), ...behindDoor(doorX, 1)].map(quadOf));
                    expect(doorFits(), `door at x ${doorX}`).toBe(true);

                    // Each block behind any of it, right behind its face or one further in, has to be there;
                    // no other has.
                    for (const block of AROUND_THICK_WALL)
                    {
                        VoxelUpdateUtil.removeVoxelBlock(undefined, voxels, quadOf(block));
                        expect(doorFits(), `door at x ${doorX}, without ${JSON.stringify(block)}`)
                            .toBe(!needed.has(quadOf(block)));
                        VoxelUpdateUtil.addVoxelBlock(undefined, voxels, quadOf(block));
                    }
                }

                // A wall one block deep would hold a picture, but not a door.
                expect(fits(canvasTypeIndex, {x: DOOR_X, y: 1, z: THIN_WALL_Z})).toBe(true);
                expect(fits(doorTypeIndex, doorPosOn(THIN_WALL_Z))).toBe(false);
            },
        });
    });

    it("keeps every block the door rests on, at either depth, and lets any other go", async () => {
        await runScenario({
            name: "blocks under a door",
            rooms: [WALLED_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const door = new AddObjectSignal(room.id, ADMIN.id, ADMIN.userName, doorTypeIndex, "wall-door",
                    new ObjectTransform(doorPosOn(THICK_WALL_Z), FACING, {...UNIT_VEC3}));
                expect(ObjectUpdateUtil.addObject(ADMIN, room, door)).toBe(true);

                const restedOn = new Set([...behindDoor(DOOR_X, 0), ...behindDoor(DOOR_X, 1)].map(quadOf));
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
