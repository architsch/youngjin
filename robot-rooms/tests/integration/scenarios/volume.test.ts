/**
 * Scenario tests: volumes (named boxes of a room's blocks; see VolumeObjectTypeConfig) — who may lay and edit one,
 * the box a transform stands for, the blocks it covers surviving storage, finding one by name, the user one is
 * kept for, and that it stops nobody and is kept with the room. What a volume kept for a user restricts is in
 * restricted-zones.test.ts.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_HUB, EMPTY_REGULAR, userAtCenter } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import BufferState from "../../../src/shared/networking/types/bufferState";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import VolumeObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/volumeObjectTypeConfig";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import ObjectAttachmentUtil from "../../../src/shared/object/util/objectAttachmentUtil";
import ObjectScaleUtil from "../../../src/shared/object/util/objectScaleUtil";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import Room from "../../../src/shared/room/types/room";
import RoomFile from "../../../src/shared/room/types/roomFile";
import RoomVolume from "../../../src/shared/room/types/roomVolume";
import { INITIAL_MULTI_PLAYER_ENTRANCE_POS, MAX_ROOM_X, MAX_ROOM_Y, MAX_ROOM_Z, NUM_COLLISION_LAYERS, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS, OBJECT_NAME_MAX_LENGTH, OBJECT_USER_NAME_MAX_LENGTH, UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";
import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";

const volumeTypeIndex = ObjectTypeConfigMap.getIndexByType("Volume");
const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
const {makeTransform, makeTransformOfRoomVolume, getBox, getRoomVolume, findByName, getName,
    getZoneUserName} = VolumeObjectTypeConfig.util;

const ADMIN = new User("an-admin", "Admin", UserTypeEnumMap.Admin, "admin@test.com", "");
const MEMBER = new User("a-member", "Member", UserTypeEnumMap.Member, "member@test.com", "");
const GUEST = new User("a-guest", "Guest", UserTypeEnumMap.Guest, "guest@test.com", "");
// The owner of the regular fixture room.
const OWNER = new User("an-owner", "Owner", UserTypeEnumMap.Member, "owner@test.com", "", "", "regular");

function makeVolumeSignal(room: Room, sourceUser: User, objectId: string = "a-volume", name?: string,
    transform: ObjectTransform = makeTransform({x: 8, y: 0, z: 21}, {x: 9, y: 3.5, z: 26})): AddObjectSignal
{
    return new AddObjectSignal(room.id, sourceUser.id, sourceUser.userName, volumeTypeIndex, objectId, transform,
        (name == undefined) ? {} : {[ObjectMetadataKeyEnumMap.Label]: new EncodableByteString(name)});
}

// A transform as it comes back from storage or off the wire.
function roundTrip(transform: ObjectTransform): ObjectTransform
{
    const bufferState = new BufferState(new Uint8Array(64));
    transform.encode(bufferState);
    return ObjectTransform.decode(new BufferState(bufferState.view.slice(0, bufferState.byteIndex))) as ObjectTransform;
}

// A box on the block grid inside the room, as the indices of its low corner and its extent in blocks.
const gridBox = fc.record({
    col: fc.integer({min: 0, max: NUM_VOXEL_COLS - 1}), numCols: fc.integer({min: 1, max: NUM_VOXEL_COLS}),
    layer: fc.integer({min: 0, max: NUM_COLLISION_LAYERS - 1}), numLayers: fc.integer({min: 1, max: NUM_COLLISION_LAYERS}),
    row: fc.integer({min: 0, max: NUM_VOXEL_ROWS - 1}), numRows: fc.integer({min: 1, max: NUM_VOXEL_ROWS}),
}).map(box => ({...box,
    numCols: Math.min(box.numCols, NUM_VOXEL_COLS - box.col),
    numLayers: Math.min(box.numLayers, NUM_COLLISION_LAYERS - box.layer),
    numRows: Math.min(box.numRows, NUM_VOXEL_ROWS - box.row)}));

describe("a volume's box", () => {
    it("is the stretch between two corners given in any order", () => {
        const a = {x: 8, y: 0, z: 21};
        const b = {x: 9, y: 3.5, z: 26};
        for (const transform of [makeTransform(a, b), makeTransform(b, a),
            makeTransform({x: a.x, y: b.y, z: a.z}, {x: b.x, y: a.y, z: b.z})])
        {
            expect(getBox(transform)).toEqual({min: a, max: b});
            expect(transform.pos).toEqual({x: 8.5, y: 1.75, z: 23.5});
        }
    });

    it("lies on the block grid, inside the room, and is never thinner than a block", () => {
        const coordinate = (limit: number) => fc.integer({min: -400, max: 100 * limit + 400}).map(n => n / 100);
        const corner = fc.record({x: coordinate(MAX_ROOM_X), y: coordinate(MAX_ROOM_Y), z: coordinate(MAX_ROOM_Z)});
        fc.assert(fc.property(corner, corner, (a, b) => {
            const {min, max} = getBox(makeTransform(a, b));
            for (const [axis, limit] of [["x", MAX_ROOM_X], ["y", MAX_ROOM_Y], ["z", MAX_ROOM_Z]] as const)
            {
                expect(Number.isInteger(2 * min[axis]), `${axis} min ${min[axis]}`).toBe(true);
                expect(Number.isInteger(2 * max[axis]), `${axis} max ${max[axis]}`).toBe(true);
                expect(min[axis]).toBeGreaterThanOrEqual(0);
                expect(max[axis]).toBeLessThanOrEqual(limit);
                expect(max[axis] - min[axis]).toBeGreaterThanOrEqual(0.5);
                // Corners already on the grid and a block apart are kept as given.
                const lo = Math.min(a[axis], b[axis]), hi = Math.max(a[axis], b[axis]);
                if (Number.isInteger(2 * lo) && Number.isInteger(2 * hi) && lo >= 0 && hi <= limit && hi - lo >= 0.5)
                    expect([min[axis], max[axis]]).toEqual([lo, hi]);
            }
        }));
    });

    it("covers the same blocks once stored and read back, whatever its size and place", () => {
        fc.assert(fc.property(gridBox, (box) => {
            const transform = makeTransform(
                {x: 0.5 * box.col, y: 0.5 * box.layer, z: 0.5 * box.row},
                {x: 0.5 * (box.col + box.numCols), y: 0.5 * (box.layer + box.numLayers), z: 0.5 * (box.row + box.numRows)});
            const expected = {rowMin: box.row, rowMax: box.row + box.numRows - 1,
                colMin: box.col, colMax: box.col + box.numCols - 1,
                collisionLayerMin: box.layer, collisionLayerMax: box.layer + box.numLayers - 1};

            expect({...getRoomVolume(transform)}).toEqual(expected);
            expect({...getRoomVolume(roundTrip(transform))}).toEqual(expected);
            // The scale it is stored at is one its type allows as it stands.
            expect(ObjectScaleUtil.sanitize(volumeTypeIndex, transform.scale)).toEqual(transform.scale);
        }));
    });

    it("is laid over the blocks it is asked to cover: rows along z, columns along x, layers up", () => {
        expect(getBox(makeTransformOfRoomVolume(new RoomVolume(42, 51, 16, 17, 0, 6))))
            .toEqual({min: {x: 8, y: 0, z: 21}, max: {x: 9, y: 3.5, z: 26}});

        fc.assert(fc.property(gridBox, (box) => {
            const blocks = new RoomVolume(box.row, box.row + box.numRows - 1, box.col, box.col + box.numCols - 1,
                box.layer, box.layer + box.numLayers - 1);
            const transform = makeTransformOfRoomVolume(blocks);
            expect({...getRoomVolume(transform)}).toEqual({...blocks});
            expect({...getRoomVolume(roundTrip(transform))}).toEqual({...blocks});
        }));
    });

    it("can be as large as the whole room", () => {
        const whole = makeTransform({x: 0, y: 0, z: 0}, {x: MAX_ROOM_X, y: MAX_ROOM_Y, z: MAX_ROOM_Z});
        expect({...getRoomVolume(roundTrip(whole))}).toEqual({rowMin: 0, rowMax: NUM_VOXEL_ROWS - 1,
            colMin: 0, colMax: NUM_VOXEL_COLS - 1, collisionLayerMin: 0, collisionLayerMax: NUM_COLLISION_LAYERS - 1});
    });
});

describe("volumes", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("are an admin's to lay anywhere and a room's superuser's in it, wherever in the room they lie", async () => {
        await runScenario({
            name: "laying a volume",
            rooms: [EMPTY_HUB, EMPTY_REGULAR],
            users: [userAtCenter("hub"), userAtCenter("regular")],
            assertions: () => {
                for (const roomID of ["hub", "regular"])
                {
                    const room = ServerRoomManager.roomRuntimeMemories[roomID].room;
                    const canAdd = (user: User) => ObjectUpdateUtil.canAddObject(user, room, makeVolumeSignal(room, user));
                    expect(canAdd(ADMIN), roomID).toBe(true);
                    expect(canAdd(MEMBER), roomID).toBe(false);
                    expect(canAdd(GUEST), roomID).toBe(false);
                    // The owner draws their own room's zones with them, and is nobody in a hub.
                    expect(canAdd(OWNER), roomID).toBe(roomID == "regular");
                    expect(ObjectUpdateUtil.canAddObject(ADMIN, room, makeVolumeSignal(room, MEMBER)), roomID).toBe(false);

                    // Through walls and open space alike: it marks blocks, and rests on none.
                    expect(ObjectUpdateUtil.canAddObject(ADMIN, room, makeVolumeSignal(room, ADMIN, "in-the-wall",
                        undefined, makeTransform({x: 0, y: 0, z: 0}, {x: 1, y: 1, z: 1}))), roomID).toBe(true);
                    expect(ObjectUpdateUtil.canAddObject(ADMIN, room, makeVolumeSignal(room, ADMIN, "in-mid-air",
                        undefined, makeTransform({x: 10, y: 2, z: 10}, {x: 12, y: 3, z: 12}))), roomID).toBe(true);
                }
            },
        });
    });

    it("are resized, named, kept for a user and removed by those who lay them alone, and take nothing else", async () => {
        await runScenario({
            name: "editing a volume",
            rooms: [EMPTY_HUB, EMPTY_REGULAR],
            users: [userAtCenter("hub"), userAtCenter("regular")],
            assertions: () => {
                for (const [roomID, layers, others] of [["hub", [ADMIN], [MEMBER, GUEST, OWNER]],
                    ["regular", [ADMIN, OWNER], [MEMBER, GUEST]]] as [string, User[], User[]][])
                {
                    const room = ServerRoomManager.roomRuntimeMemories[roomID].room;
                    const volume = makeVolumeSignal(room, ADMIN);
                    expect(ObjectUpdateUtil.addObject(ADMIN, room, volume)).toBe(true);

                    const resized = makeTransform({x: 8, y: 0, z: 21}, {x: 12, y: 2, z: 30});
                    const canResize = (user: User, ignorePhysics: boolean) => ObjectUpdateUtil.canSetObjectTransform(user,
                        room, new SetObjectTransformSignal(room.id, volume.objectId, resized, ignorePhysics));
                    const canSet = (user: User, key: number, value: string) => ObjectUpdateUtil.canSetObjectMetadata(
                        user, room, new SetObjectMetadataSignal(room.id, volume.objectId, key, value));
                    const canRemove = (user: User) => ObjectUpdateUtil.canRemoveObject(user, room,
                        new RemoveObjectSignal(room.id, volume.objectId));

                    for (const user of layers)
                    {
                        expect(canResize(user, true), roomID).toBe(true);
                        expect(canResize(user, false), roomID).toBe(false); // a placement, never a push
                        expect(canSet(user, ObjectMetadataKeyEnumMap.Label, "wall1"), roomID).toBe(true);
                        expect(canSet(user, ObjectMetadataKeyEnumMap.Label, "w".repeat(OBJECT_NAME_MAX_LENGTH))).toBe(true);
                        expect(canSet(user, ObjectMetadataKeyEnumMap.Label, "w".repeat(OBJECT_NAME_MAX_LENGTH + 1))).toBe(false);
                        expect(canSet(user, ObjectMetadataKeyEnumMap.ZoneUserName, MEMBER.userName), roomID).toBe(true);
                        expect(canSet(user, ObjectMetadataKeyEnumMap.ZoneUserName, ""), roomID).toBe(true);
                        expect(canSet(user, ObjectMetadataKeyEnumMap.SentMessage, "Hello!")).toBe(false);
                        expect(canSet(user, ObjectMetadataKeyEnumMap.QuarterTurns, "!")).toBe(false);
                        expect(canRemove(user), roomID).toBe(true);
                    }
                    for (const user of others)
                    {
                        expect(canResize(user, true), roomID).toBe(false);
                        expect(canSet(user, ObjectMetadataKeyEnumMap.Label, "wall1"), roomID).toBe(false);
                        expect(canSet(user, ObjectMetadataKeyEnumMap.ZoneUserName, user.userName), roomID).toBe(false);
                        expect(canRemove(user), roomID).toBe(false);
                    }

                    // Kept for a user, it is still none of that user's to edit: only what lies in it is.
                    expect(ObjectUpdateUtil.setObjectMetadata(ADMIN, room, new SetObjectMetadataSignal(room.id,
                        volume.objectId, ObjectMetadataKeyEnumMap.ZoneUserName, MEMBER.userName))).toBe(true);
                    expect(canResize(MEMBER, true), roomID).toBe(false);
                    expect(canSet(MEMBER, ObjectMetadataKeyEnumMap.ZoneUserName, ""), roomID).toBe(false);
                    expect(canRemove(MEMBER), roomID).toBe(false);
                    // And no zone holds against the tools of those it is theirs to edit, its own least of all.
                    for (const user of layers)
                    {
                        expect(canResize(user, true), roomID).toBe(true);
                        expect(canRemove(user), roomID).toBe(true);
                    }

                    // A resize is taken as sent: the box it stands for afterwards is the one asked for.
                    ObjectUpdateUtil.setObjectTransform(ADMIN, room,
                        new SetObjectTransformSignal(room.id, volume.objectId, roundTrip(resized), true));
                    expect(getBox(volume.transform)).toEqual({min: {x: 8, y: 0, z: 21}, max: {x: 12, y: 2, z: 30}});
                }
            },
        });
    });

    it("hold the name of the user they are kept for as it is matched: trimmed, and no longer than a name is", async () => {
        await runScenario({
            name: "naming a volume's user",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const volume = makeVolumeSignal(room, ADMIN);
                expect(ObjectUpdateUtil.addObject(ADMIN, room, volume)).toBe(true);
                const keepFor = (userName: string) => ObjectUpdateUtil.setObjectMetadata(ADMIN, room,
                    new SetObjectMetadataSignal(room.id, volume.objectId, ObjectMetadataKeyEnumMap.ZoneUserName, userName));

                // Laid already kept for somebody (as an undone removal lays it again), unless for a name too long.
                const comingKeptFor = (userName: string) => {
                    const signal = makeVolumeSignal(room, ADMIN, "another-volume");
                    signal.metadata[ObjectMetadataKeyEnumMap.ZoneUserName] = new EncodableByteString(userName);
                    return ObjectUpdateUtil.canAddObject(ADMIN, room, signal);
                };
                expect(comingKeptFor("somebody#2")).toBe(true);
                expect(comingKeptFor("u".repeat(OBJECT_USER_NAME_MAX_LENGTH))).toBe(true);
                expect(comingKeptFor("u".repeat(OBJECT_USER_NAME_MAX_LENGTH + 1))).toBe(false);

                expect(getZoneUserName(volume)).toBe("");
                expect(keepFor("  somebody#2 ")).toBe(true);
                expect(getZoneUserName(volume)).toBe("somebody#2");
                expect(volume.metadata[ObjectMetadataKeyEnumMap.ZoneUserName].str).toBe("somebody#2"); // as stored, too
                expect(keepFor("u".repeat(OBJECT_USER_NAME_MAX_LENGTH + 10))).toBe(true);
                expect(getZoneUserName(volume)).toBe("u".repeat(OBJECT_USER_NAME_MAX_LENGTH));
                expect(keepFor("   ")).toBe(true);
                expect(getZoneUserName(volume)).toBe("");
            },
        });
    });

    it("are found by name: the first of a name, and none by no name", async () => {
        await runScenario({
            name: "finding a volume",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const unnamed = makeVolumeSignal(room, ADMIN, "unnamed");
                const first = makeVolumeSignal(room, ADMIN, "first", "wall1");
                const second = makeVolumeSignal(room, ADMIN, "second", "wall1");
                const other = makeVolumeSignal(room, ADMIN, "other", "  the   way out ");
                for (const volume of [unnamed, first, second, other])
                    expect(ObjectUpdateUtil.addObject(ADMIN, room, volume)).toBe(true);

                expect(findByName(room, "wall1")).toBe(first);
                expect(findByName(room, "wall2")).toBeUndefined();
                // As read: a name's spacing doesn't change what it is called.
                expect(getName(other)).toBe("the way out");
                expect(findByName(room, "the way out")).toBe(other);
                // Another kind of object called the same is no volume.
                room.objectGroup.addObject(new AddObjectSignal(room.id, ADMIN.id, ADMIN.userName, lampTypeIndex, "lamp",
                    new ObjectTransform({x: 5, y: 2, z: 5}, {x: 0, y: -1, z: 0}, UNIT_VEC3),
                    {[ObjectMetadataKeyEnumMap.Label]: new EncodableByteString("wall3")}));
                expect(getName(room.objectById["lamp"])).toBe("wall3");
                expect(findByName(room, "wall3")).toBeUndefined();

                // Renamed as an admin would rename it.
                expect(ObjectUpdateUtil.setObjectMetadata(ADMIN, room, new SetObjectMetadataSignal(room.id, "unnamed",
                    ObjectMetadataKeyEnumMap.Label, " wall2 "))).toBe(true);
                expect(findByName(room, "wall2")).toBe(unnamed);
            },
        });
    });

    it("stop nobody, and leave what is inside them to be built on as before", async () => {
        await runScenario({
            name: "a volume in the way of nothing",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                // A lamp on the boundary wall, clear of the room's door.
                const lamp = new AddObjectSignal(room.id, MEMBER.id, MEMBER.userName, lampTypeIndex, "a-lamp",
                    new ObjectTransform({x: INITIAL_MULTI_PLAYER_ENTRANCE_POS.x - 5, y: 2.25,
                        z: INITIAL_MULTI_PLAYER_ENTRANCE_POS.z}, {x: 0, y: 0, z: -1}, {...UNIT_VEC3}));
                expect(ObjectUpdateUtil.canAddObject(MEMBER, room, lamp)).toBe(true);

                // The whole room marked, the lamp's stretch of wall included.
                const whole = makeVolumeSignal(room, ADMIN, "whole-room", "everything",
                    makeTransform({x: 0, y: 0, z: 0}, {x: MAX_ROOM_X, y: MAX_ROOM_Y, z: MAX_ROOM_Z}));
                expect(ObjectUpdateUtil.addObject(ADMIN, room, whole)).toBe(true);

                expect(ObjectUpdateUtil.canAddObject(MEMBER, room, lamp)).toBe(true);
                expect(ObjectAttachmentUtil.canPlaceObject(room, lamp.objectId, lampTypeIndex, lamp.transform)).toBe(true);
                const {hitbox, colliderConfig} = PhysicsColliderStateUtil.getObjectColliderState(volumeTypeIndex, whole.transform)!;
                expect(hitbox.halfSize).toEqual({x: 0.5 * MAX_ROOM_X, y: 0.5 * MAX_ROOM_Y, z: 0.5 * MAX_ROOM_Z});
                expect(colliderConfig.applyHardCollisionToOthers).toBe(false);
                expect(colliderConfig.outgoingSoftCollisionForceMultiplier).toBe(0);
                // A body standing in the open, inside the volume, meets nothing hard.
                expect(PhysicsColliderStateUtil.boxOverlapsHardCollider(PhysicsManager.physicsRooms["hub"],
                    {center: {x: 10, y: 1, z: 10}, halfSize: {x: 0.3, y: 0.9, z: 0.3}})).toBe(false);
            },
        });
    });

    it("are kept with the room", async () => {
        await runScenario({
            name: "a volume in the room's content",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                room.dirty = false;
                expect(ObjectUpdateUtil.addObject(ADMIN, room, makeVolumeSignal(room, ADMIN, "a-volume", "wall1"))).toBe(true);

                expect(VolumeObjectTypeConfig.persistent).toBe(true);
                expect(room.dirty).toBe(true);
                const kept = RoomFile.fromRoom(room).objectGroup.objectById["a-volume"];
                expect(kept).toBeDefined();
                expect(getName(kept)).toBe("wall1");
            },
        });
    });
});
