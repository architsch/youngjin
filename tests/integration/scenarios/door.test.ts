/**
 * Scenario tests: doors (admin world-building) — who may add, remove, move and edit them, how their
 * metadata is validated, and where arriving players spawn.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_HUB, EMPTY_REGULAR, userAtCenter } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import SpawnHotspotUtil from "../../../src/server/room/util/spawnHotspotUtil";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectMetadataEntryMap from "../../../src/shared/object/maps/objectMetadataEntryMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import DoorObjectTypeConfig, { ENTRANCE_DOOR_OBJECT_ID,
    SPAWN_DIST_BEHIND_DOOR } from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
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
import RoomValidationUtil from "../../../src/shared/room/util/roomValidationUtil";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import VoxelQuadsRuntimeMemory from "../../../src/shared/voxel/types/voxelQuadsRuntimeMemory";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import WallAttachedObjectUtil from "../../../src/shared/object/util/wallAttachedObjectUtil";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MIN,
    LABEL_COLOR_PALETTE_NAME, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL,
    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS, OBJECT_LABEL_MAX_LENGTH, SANDBOX_SINGLE_PLAYER_MODE,
    TUTORIAL_SINGLE_PLAYER_MODE } from "../../../src/shared/system/sharedConstants";

const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");
const DOOR_FOOTPRINT_HEIGHT =
    DoorObjectTypeConfig.components.spawnedByAny.collider.hitboxSize.sizeY;

function makeUser(id: string, userType: number): User
{
    return new User(id, `User_${id}`, userType, `${id}@test.com`, "");
}

const ADMIN = makeUser("an-admin", UserTypeEnumMap.Admin);
const MEMBER = makeUser("a-member", UserTypeEnumMap.Member);
const GUEST = makeUser("a-guest", UserTypeEnumMap.Guest);

// A door on the boundary wall, well clear of the room's existing one.
function makeDoorSignal(room: Room, sourceUser: User, objectId: string = "new-door"): AddObjectSignal
{
    return new AddObjectSignal(room.id, sourceUser.id, sourceUser.userName, doorTypeIndex, objectId,
        new ObjectTransform(
            {
                x: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL - 5 + 0.5,
                y: 0.5 * DOOR_FOOTPRINT_HEIGHT,
                z: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
            },
            {x: 0, y: 0, z: -1}));
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

    it("refuses a door in a regular room, even to an admin", async () => {
        // Regular rooms keep their generated door; admins shape hubs only.
        await runScenario({
            name: "hanging a door in a regular room",
            rooms: [EMPTY_REGULAR],
            users: [userAtCenter("regular")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["regular"].room;
                for (const user of [ADMIN, MEMBER])
                {
                    expect(ObjectUpdateUtil.canAddObject(user, room,
                        makeDoorSignal(room, user))).toBe(false);
                }
            },
        });
    });

    it("lets an admin manage doors in the sandbox, but in no other single-player room", () => {
        // The sandbox's edits stay local, so it stands in for a hub when trying out admin tools.
        const singlePlayerRoom = (name: string) => new Room(name, name, RoomTypeEnumMap.SinglePlayer, "", "",
            "default", "", new VoxelGrid([], new VoxelQuadsRuntimeMemory()), new ObjectGroup([]));
        const sandbox = singlePlayerRoom(SANDBOX_SINGLE_PLAYER_MODE);
        const tutorial = singlePlayerRoom(TUTORIAL_SINGLE_PLAYER_MODE);

        expect(RoomValidationUtil.canUserManageDoors(ADMIN, sandbox)).toBe(true);
        expect(RoomValidationUtil.canUserManageDoors(MEMBER, sandbox)).toBe(false);
        expect(RoomValidationUtil.canUserManageDoors(GUEST, sandbox)).toBe(false);
        expect(RoomValidationUtil.canUserManageDoors(ADMIN, tutorial)).toBe(false);
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
                expect(canSet(ObjectMetadataKeyEnumMap.InstancedMeshComposition, "abc")).toBe(true);

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
                expect(DoorObjectTypeConfig.util.getLabelColorIndex(door)).toBe(
                    ColorUtil.rgbToPaletteIndex(LABEL_COLOR_PALETTE_NAME,
                        ColorUtil.hexToRGB(configuredHex)));

                door.metadata[ObjectMetadataKeyEnumMap.LabelColor] = new EncodableByteString("7");
                expect(DoorObjectTypeConfig.util.getLabelColorIndex(door)).toBe(7);
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
                expect(DoorObjectTypeConfig.util.getLabel(bare)).toBe("");
                expect(DoorObjectTypeConfig.util.getDestinationRoomId(bare)).toBe("");
                expect(DoorObjectTypeConfig.util.getDestinationDoorLabel(bare)).toBe("");
                expect(DoorObjectTypeConfig.util.getDoorType(bare)).toBe(DoorTypeEnumMap.CustomEntrance);
            },
        });
    });
});

/**
 * Moving a door vertically: a door is an odd number of layers tall, so its center is off-grid; the
 * bottom edge is snapped instead (snapping the center would float it a quarter layer).
 */
describe("moving a door up the wall", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("leaves it standing on a floor a whole number of layers up", async () => {
        await runScenario({
            name: "door vertical movement",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const door = getEntranceDoor(room);
                const spawnedY = door.transform.pos.y;

                // As generated: on the floor, center half a footprint up.
                expect(spawnedY).toBeCloseTo(0.5 * DOOR_FOOTPRINT_HEIGHT, 6);

                // Each step is one layer, landing the foot exactly on a layer boundary.
                let y = spawnedY;
                for (let step = 1; step <= 4; ++step)
                {
                    const result = WallAttachedObjectUtil.getMoveResult(room, door, 0, 0.5, 0);
                    expect(result).toBeDefined();
                    y = result!.newPos.y;
                    expect(y).toBeCloseTo(spawnedY + step * COLLISION_LAYER_HEIGHT, 6);
                    door.transform.pos = result!.newPos;
                }

                // And back down again to exactly where it started.
                for (let step = 1; step <= 4; ++step)
                {
                    const result = WallAttachedObjectUtil.getMoveResult(room, door, 0, -0.5, 0);
                    expect(result).toBeDefined();
                    door.transform.pos = result!.newPos;
                }
                expect(door.transform.pos.y).toBeCloseTo(spawnedY, 6);
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

    function addDoor(room: Room, objectId: string, col: number, label: string, doorType: number)
    {
        const door = DoorObjectTypeConfig.util.makeEntranceDoor(room.id, col, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
            COLLISION_LAYER_MIN);
        door.objectId = objectId;
        door.metadata[ObjectMetadataKeyEnumMap.Label] = new EncodableByteString(label);
        door.metadata[ObjectMetadataKeyEnumMap.DoorType] = new EncodableByteString(`${doorType}`);
        room.objectById[objectId] = door;
        return door;
    }

    it("puts him behind the door he was sent to, wherever that door is", async () => {
        await runScenario({
            name: "named destination door",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const named = addDoor(room, "side-door", 6, "Side Door",
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
                delete room.objectById[ENTRANCE_DOOR_OBJECT_ID];
                const custom = addDoor(room, "side-door", 6, "", DoorTypeEnumMap.CustomEntrance);

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
                        delete room.objectById[objectId];
                }

                const {pos} = SpawnHotspotUtil.pickSpawnTransform(room, "");
                expect(pos.x).toBeCloseTo(0.5 * NUM_VOXEL_COLS, 3);
                expect(pos.z).toBeCloseTo(0.5 * NUM_VOXEL_ROWS, 3);
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
                addDoor(room, "side-door", 6, "", DoorTypeEnumMap.CustomEntrance);

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
