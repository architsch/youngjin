/**
 * Scenario tests: doors, and the admin privilege they exist for
 *
 * A door is how one room is joined to another, so laying one is an edit to the shape of the world
 * rather than to a room's contents. That is the whole of what these cover:
 *
 * - who may put a door up, take one down, move one, and change what it says and where it goes
 * - which metadata a door answers to at all, and what it makes of a value it is handed
 * - where an arriving player is put down, which is a question about the doors the room holds
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_HUB, EMPTY_REGULAR, userAtCenter } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import SpawnHotspotUtil from "../../../src/server/room/util/spawnHotspotUtil";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectMetadataEntryMap from "../../../src/shared/object/maps/objectMetadataEntryMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import DoorObjectUtil, { ENTRANCE_DOOR_OBJECT_ID } from "../../../src/shared/object/util/doorObjectUtil";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import { DoorTypeEnumMap } from "../../../src/shared/object/types/doorType";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import Room from "../../../src/shared/room/types/room";
import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import WallAttachedObjectUtil from "../../../src/shared/object/util/wallAttachedObjectUtil";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MIN, DOOR_FOOTPRINT_HEIGHT,
    LABEL_COLOR_PALETTE_NAME, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL,
    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS, OBJECT_LABEL_MAX_LENGTH } from "../../../src/shared/system/sharedConstants";

const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");

function makeUser(id: string, userType: number): User
{
    return new User(id, `User_${id}`, userType, `${id}@test.com`, "");
}

const ADMIN = makeUser("an-admin", UserTypeEnumMap.Admin);
const MEMBER = makeUser("a-member", UserTypeEnumMap.Member);
const GUEST = makeUser("a-guest", UserTypeEnumMap.Guest);

// A door somewhere along the boundary wall well clear of the one the room already has, so that
// nothing here is really asking whether two doors fit on the same stretch of wall.
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
        // A Regular room belongs to one person and keeps the one door generation gave it. An admin
        // shapes the world out of hubs; he does not rearrange the way into somebody's own room.
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
        // A door is slid along the wall by a gizmo, which is a placement rather than a motion — the
        // physics-resolved path is for things that walk.
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

        // Anything that is not a door type at all comes out as the safer of the two: a door nobody
        // said anything sensible about is not one arriving players are put down behind.
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

                // Nothing said about it, so the picker opens on whichever palette position is
                // nearest the color the door's own type declares — which is the color the label is
                // actually wearing, so picking that same swatch back changes nothing.
                const configuredHex = ObjectTypeConfigMap.getConfigByIndex(doorTypeIndex)
                    .components.spawnedByAny!.labelText!.defaultFontColorHex;
                expect(DoorObjectUtil.getLabelColorIndex(door)).toBe(
                    ColorUtil.rgbToPaletteIndex(LABEL_COLOR_PALETTE_NAME,
                        ColorUtil.hexToRGB(configuredHex)));

                door.metadata[ObjectMetadataKeyEnumMap.LabelColor] = new EncodableByteString("7");
                expect(DoorObjectUtil.getLabelColorIndex(door)).toBe(7);
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
                expect(DoorObjectUtil.getLabel(bare)).toBe("");
                expect(DoorObjectUtil.getDestinationRoomId(bare)).toBe("");
                expect(DoorObjectUtil.getDestinationDoorLabel(bare)).toBe("");
                expect(DoorObjectUtil.getDoorType(bare)).toBe(DoorTypeEnumMap.CustomEntrance);
            },
        });
    });
});

/**
 * Sliding a door up and down the wall.
 *
 * A door stands an odd number of collision layers tall, so the middle of it — which is where its
 * position is — falls half a layer off the grid the wall is built on. Snapping that middle onto the
 * grid would lift the door a quarter of a layer clear of the floor and keep it there, so what is
 * snapped is the door's bottom edge instead.
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

                // Where generation put it: standing on the room's floor, so its middle is half a
                // footprint up.
                expect(spawnedY).toBeCloseTo(0.5 * DOOR_FOOTPRINT_HEIGHT, 6);

                // Each step up is one collision layer, and the door's foot lands on that layer's
                // boundary — never a quarter of a layer above it.
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
 * Where an arriving player is put down.
 *
 * A room may hold several doors, so this is a real question rather than a fixed cell, and it is
 * answered by asking for something more and more general until something answers: the door the
 * traveller named, then any door the room offers as its way in, then any door at all, then the room
 * itself. Each step exists because the one before it can genuinely come up empty.
 */
describe("choosing where a player arrives", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    function addDoor(room: Room, objectId: string, col: number, label: string, doorType: number)
    {
        const door = DoorObjectUtil.makeEntranceDoor(room.id, col, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
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

                // A pace out from that door's face, on the floor it stands on, facing away from it.
                expect(pos.x).toBeCloseTo(named.transform.pos.x, 3);
                expect(pos.z).toBeLessThan(named.transform.pos.z);
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

                // Drawn at random among equals, so this is asked repeatedly: what is being asserted
                // is that the custom door is never among them.
                for (let attempt = 0; attempt < 20; ++attempt)
                {
                    const {pos} = SpawnHotspotUtil.pickSpawnTransform(room, "");
                    expect(pos.x).toBeCloseTo(entrance.transform.pos.x, 3);
                }
            },
        });
    });
});
