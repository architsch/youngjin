/**
 * Room files: the file an admin saves a room to (RoomFile), and what loading one over a live room does
 * to the room, to the users in it and to what is stored (ServerRoomManager.loadRoomFile).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { checkNoUserInMultipleRooms, checkObjectTransformConsistency, checkPhysicsObjectConsistency,
    checkPhysicsRoomConsistency, checkPlayerObjectsExist, checkRoomIDReferences, checkRoomParticipantCounts,
    checkUserManagerCount, checkValidSocketContexts, getPendingSignals } from "../helpers/invariants";
import { createTestRoom } from "../helpers/roomContent";
import { writeLegacyObjectGroup } from "../helpers/legacyObjectGroup";
import { MockUserOverrides } from "../helpers/mockUser";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerVoxelManager from "../../../src/server/voxel/serverVoxelManager";
import SpawnHotspotUtil from "../../../src/server/room/util/spawnHotspotUtil";
import DBRoomUtil from "../../../src/server/db/util/dbRoomUtil";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import Room from "../../../src/shared/room/types/room";
import RoomFile from "../../../src/shared/room/types/roomFile";
import RoomChangedSignal from "../../../src/shared/room/types/roomChangedSignal";
import RoomRuntimeMemory from "../../../src/shared/room/types/roomRuntimeMemory";
import RoomPrefsUtil from "../../../src/shared/room/util/roomPrefsUtil";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import BufferState from "../../../src/shared/networking/types/bufferState";
import EncodableArray from "../../../src/shared/networking/types/encodableArray";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import EncodableRawByteNumber from "../../../src/shared/networking/types/encodableRawByteNumber";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import SignalTypeConfigMap from "../../../src/shared/networking/maps/signalTypeConfigMap";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import DoorObjectTypeConfig, { ENTRANCE_DOOR_OBJECT_ID } from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import RestrictedZone from "../../../src/shared/voxel/types/restrictedZone";
import AddVoxelBlockSignal from "../../../src/shared/voxel/types/update/addVoxelBlockSignal";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import { COLLISION_LAYER_MIN, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
    NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS,
    UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";

const SIGNATURE = "ThingsPoolRoom";

const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");
const labelTypeIndex = ObjectTypeConfigMap.getIndexByType("Label");

const isPersistent = (obj: AddObjectSignal) =>
    ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex).persistent;

// What sets the source room apart from the bare fixture every scenario room starts as.
const SOURCE_TEXTURE_PACK_PATH = "garden";
const SOURCE_INITIAL_JOIN_PRIORITY = 7;
const SOURCE_PREFS = RoomPrefsUtil.encode({...RoomPrefsUtil.decode(""),
    fogNearStep: 10, fogFarStep: 40, initialJoinPriority: SOURCE_INITIAL_JOIN_PRIORITY});
const SOURCE_ZONE = new RestrictedZone(2, 6, 2, 6);
const SOURCE_BLOCK = {row: 10, col: 10};
const SOURCE_LABEL_ID = "a-label";
// On the west wall, where the fixture's door is on the south one.
const SOURCE_DOOR_CELL = {row: 16, col: 0};

// A room to save: a door on another wall, a block on the floor, a label, a zone, settings of its own, and
// somebody standing in it.
function makeSourceRoom(): Room
{
    const room = createTestRoom("source", "", RoomTypeEnumMap.Hub, "", "", SOURCE_TEXTURE_PACK_PATH);
    room.prefs = SOURCE_PREFS;
    room.voxelGrid.restrictedZones = [SOURCE_ZONE];
    VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels,
        VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(SOURCE_BLOCK.row, SOURCE_BLOCK.col, COLLISION_LAYER_MIN),
        new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(5));

    room.objectGroup = new ObjectGroup([
        DoorObjectTypeConfig.util.makeEntranceDoor(room.id, SOURCE_DOOR_CELL.col, SOURCE_DOOR_CELL.row,
            COLLISION_LAYER_MIN),
        new AddObjectSignal(room.id, "a-builder", "Builder", labelTypeIndex, SOURCE_LABEL_ID,
            new ObjectTransform(
                {x: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL - 4.5, y: 2.25, z: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW},
                {x: 0, y: 0, z: -1}, {...UNIT_VEC3}),
            {[ObjectMetadataKeyEnumMap.Label]: new EncodableByteString("Library")}),
        new AddObjectSignal(room.id, "a-visitor", "Visitor", playerTypeIndex, "@99",
            new ObjectTransform({x: 5, y: 1.25, z: 5}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3})),
    ]);
    return room;
}

function toBytes(roomFile: RoomFile): Uint8Array
{
    const bufferState = EncodingUtil.startEncoding();
    roomFile.encode(bufferState);
    return new Uint8Array(EncodingUtil.endEncoding(bufferState));
}

function fromBytes(bytes: Uint8Array, roomID: string = "target"): RoomFile
{
    return RoomFile.decodeWithParams(new BufferState(bytes), roomID) as RoomFile;
}

// The room's contents as the server stores them (see DBRoomUtil.saveRoomContent).
function encodeStoredContent(room: Room): Uint8Array
{
    const bufferState = EncodingUtil.startEncoding();
    room.voxelGrid.encode(bufferState);
    new ObjectGroup(Object.values(room.objectById).filter(isPersistent)).encode(bufferState);
    return new Uint8Array(EncodingUtil.endEncoding(bufferState));
}

function encodeVoxelGrid(voxelGrid: VoxelGrid): Uint8Array
{
    const bufferState = EncodingUtil.startEncoding();
    voxelGrid.encode(bufferState);
    return new Uint8Array(EncodingUtil.endEncoding(bufferState));
}

function concat(...parts: (Uint8Array | number[])[]): Uint8Array
{
    return new Uint8Array(parts.flatMap(part => Array.from(part)));
}

// A string as EncodableByteString writes it.
function encodeString(str: string): number[]
{
    return [...new TextEncoder().encode(str), 0];
}

function isBlockSolid(voxelGrid: VoxelGrid, row: number, col: number, collisionLayer: number): boolean
{
    return VoxelQueryUtil.isVoxelCollisionLayerOccupied(
        VoxelQueryUtil.getVoxel(voxelGrid.voxels, row, col)!, collisionLayer);
}

// The harness's invariants, less the one that whoever placed an object is in the room: a file's objects
// were placed by whoever built the room it was saved from.
function checkInvariants(connectedUsers: ConnectedUser[])
{
    checkUserManagerCount(connectedUsers);
    checkValidSocketContexts();
    checkRoomParticipantCounts();
    checkRoomIDReferences();
    checkNoUserInMultipleRooms();
    checkPlayerObjectsExist();
    checkObjectTransformConsistency(connectedUsers);
    checkPhysicsRoomConsistency();
    checkPhysicsObjectConsistency();
}

describe("room file: the stored format", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("is the room's stored contents behind a signature and a version, then its settings", () => {
        const room = makeSourceRoom();

        expect(Array.from(toBytes(RoomFile.fromRoom(room)))).toEqual(Array.from(concat(
            encodeString(SIGNATURE).slice(0, -1), [0],
            encodeStoredContent(room),
            encodeString(SOURCE_TEXTURE_PACK_PATH),
            encodeString(SOURCE_PREFS))));
    });

    it("comes back as it was written", () => {
        const bytes = toBytes(RoomFile.fromRoom(makeSourceRoom()));
        const roomFile = fromBytes(bytes);

        expect(roomFile.texturePackPath).toBe(SOURCE_TEXTURE_PACK_PATH);
        expect(roomFile.prefs).toBe(SOURCE_PREFS);
        expect(roomFile.voxelGrid.restrictedZones).toEqual([SOURCE_ZONE]);
        expect(isBlockSolid(roomFile.voxelGrid, SOURCE_BLOCK.row, SOURCE_BLOCK.col, COLLISION_LAYER_MIN)).toBe(true);
        expect(roomFile.objectGroup.objectById[SOURCE_LABEL_ID].metadata[ObjectMetadataKeyEnumMap.Label].str)
            .toBe("Library");

        // Writing what was read gives the same file, byte for byte.
        expect(Array.from(toBytes(roomFile))).toEqual(Array.from(bytes));
    });

    it("leaves out the objects that don't persist", () => {
        const room = makeSourceRoom();
        expect(Object.values(room.objectById).some(obj => obj.objectTypeIndex == playerTypeIndex)).toBe(true);

        const roomFile = fromBytes(toBytes(RoomFile.fromRoom(room)));

        expect(Object.keys(roomFile.objectGroup.objectById).sort())
            .toEqual([SOURCE_LABEL_ID, ENTRANCE_DOOR_OBJECT_ID].sort());
    });

    it("names no room: its objects are read into whichever room takes it", () => {
        const roomFile = fromBytes(toBytes(RoomFile.fromRoom(makeSourceRoom())), "another-room");

        for (const obj of Object.values(roomFile.objectGroup.objectById))
            expect(obj.roomID).toBe("another-room");
    });

    it("converts older contents as it reads them", () => {
        // A grid written by the version-1 encoder (see the fixtures' README), with objects as old.
        const legacyGridBytes = new Uint8Array(fs.readFileSync(
            path.join(__dirname, "../fixtures/legacyVoxelGrids/bare.bin")));
        const legacyObjects = new BufferState(new Uint8Array(1024));
        writeLegacyObjectGroup(legacyObjects, [], 0);

        const roomFile = fromBytes(concat(
            encodeString(SIGNATURE).slice(0, -1), [0],
            legacyGridBytes,
            legacyObjects.view.subarray(0, legacyObjects.byteIndex),
            encodeString("default"),
            encodeString("")));

        expect(roomFile.voxelGrid.sourceFormatVersion).toBe(1);
        expect(roomFile.objectGroup.sourceFormatVersion).toBe(0);
        expect(roomFile.voxelGrid.voxels).toHaveLength(NUM_VOXEL_ROWS * NUM_VOXEL_COLS);

        // Rooms that old stored no entrance door, so the conversion hangs one, in the room being read into.
        const door = roomFile.objectGroup.objectById[ENTRANCE_DOOR_OBJECT_ID];
        expect(door.objectTypeIndex).toBe(doorTypeIndex);
        expect(door.roomID).toBe("target");

        // Written again, it is in today's formats.
        const rewritten = fromBytes(toBytes(roomFile));
        expect(rewritten.voxelGrid.sourceFormatVersion).toBe(VoxelGrid.latestFormatVersion);
        expect(rewritten.objectGroup.sourceFormatVersion).toBe(ObjectGroup.latestFormatVersion);
    });

    describe("refuses", () => {
        const bytes = () => toBytes(RoomFile.fromRoom(makeSourceRoom()));
        const versionIndex = SIGNATURE.length;
        const voxelGridVersionIndex = versionIndex + 1;

        it("a file of another kind", () => {
            const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13]);
            expect(() => fromBytes(png)).toThrow();
            expect(() => fromBytes(new Uint8Array(0))).toThrow();
        });

        it("a room's stored contents alone, which carry no signature", () => {
            expect(() => fromBytes(encodeStoredContent(makeSourceRoom()))).toThrow();
        });

        it("a file cut short", () => {
            const whole = bytes();
            expect(() => fromBytes(whole.slice(0, whole.length - 1))).toThrow();
            expect(() => fromBytes(whole.slice(0, Math.floor(whole.length / 2)))).toThrow();
            expect(() => fromBytes(whole.slice(0, SIGNATURE.length))).toThrow();
        });

        it("a file with anything after its end", () => {
            expect(() => fromBytes(concat(bytes(), [0]))).toThrow();
        });

        it("a file written in a newer format than this build reads", () => {
            const newerFile = bytes();
            newerFile[versionIndex]++;
            expect(() => fromBytes(newerFile)).toThrow();

            const newerVoxels = bytes();
            expect(newerVoxels[voxelGridVersionIndex]).toBe(VoxelGrid.latestFormatVersion);
            newerVoxels[voxelGridVersionIndex]++;
            expect(() => fromBytes(newerVoxels)).toThrow();

            const newerObjects = bytes();
            const objectGroupVersionIndex = voxelGridVersionIndex
                + encodeVoxelGrid(makeSourceRoom().voxelGrid).length;
            expect(newerObjects[objectGroupVersionIndex]).toBe(ObjectGroup.latestFormatVersion);
            newerObjects[objectGroupVersionIndex]++;
            expect(() => fromBytes(newerObjects)).toThrow();
        });
    });
});

describe("room file: loading one over a live room", () => {
    const HUB = "hub";
    const HUB_INITIAL_JOIN_PRIORITY = 2;

    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.mocked(DBRoomUtil.changeRoomSettings).mockClear();
        vi.mocked(DBRoomUtil.saveRoomContent).mockClear();

        harness.reset();
        harness.seedHub(HUB, HUB_INITIAL_JOIN_PRIORITY);
    });

    async function connectTo(roomID: string, overrides?: MockUserOverrides): Promise<ConnectedUser>
    {
        const ctx = harness.connectUser(overrides);
        await harness.joinRoom(ctx, roomID);
        return ctx;
    }

    // Sends what is queued, as the batch interval would, and forgets what each socket has been sent.
    function flush(...users: ConnectedUser[])
    {
        for (const user of users)
        {
            user.socketUserContext.processAllPendingSignalsToUser();
            user.socket.clearEmitted();
        }
    }

    // The source room's file as the route reads it for the room it is loaded into.
    function readSourceFile(roomID: string = HUB): RoomFile
    {
        return fromBytes(toBytes(RoomFile.fromRoom(makeSourceRoom())), roomID);
    }

    function getRoom(roomID: string = HUB): Room
    {
        return ServerRoomManager.roomRuntimeMemories[roomID].room;
    }

    // The room as the user's client is sent it: the one signal of the user's next batch.
    function receiveRoom(user: ConnectedUser): RoomRuntimeMemory
    {
        user.socket.clearEmitted();
        user.socketUserContext.processAllPendingSignalsToUser();
        const batches = user.socket.getEmitted("signalBatch");
        expect(batches).toHaveLength(1);

        const bufferState = new BufferState(new Uint8Array(batches[0]));
        expect((EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n)
            .toBe(SignalTypeConfigMap.getIndexByType("roomChangedSignal"));
        const signals = (EncodableArray.decodeWithParams(bufferState, RoomChangedSignal.decode, 65535) as EncodableArray).arr;
        expect(signals).toHaveLength(1);
        expect(bufferState.byteIndex).toBe(bufferState.view.length);
        return (signals[0] as RoomChangedSignal).roomRuntimeMemory;
    }

    it("replaces the room's voxels, persistent objects and settings with the file's", async () => {
        const admin = await connectTo(HUB, {userType: UserTypeEnumMap.Admin});
        const room = getRoom();
        const roomFile = readSourceFile();

        expect(await ServerRoomManager.loadRoomFile(HUB, roomFile)).toBe(true);

        expect(room.voxelGrid).toBe(roomFile.voxelGrid);
        expect(room.voxelGrid.restrictedZones).toEqual([SOURCE_ZONE]);
        expect(isBlockSolid(room.voxelGrid, SOURCE_BLOCK.row, SOURCE_BLOCK.col, COLLISION_LAYER_MIN)).toBe(true);

        const persistentObjects = Object.values(room.objectById).filter(isPersistent);
        expect(persistentObjects.map(obj => obj.objectId).sort())
            .toEqual([SOURCE_LABEL_ID, ENTRANCE_DOOR_OBJECT_ID].sort());
        for (const obj of persistentObjects)
        {
            expect(obj.roomID).toBe(HUB);
            expect(roomFile.objectGroup.objectById[obj.objectId]).toBe(obj);
        }

        expect(room.texturePackPath).toBe(SOURCE_TEXTURE_PACK_PATH);
        checkInvariants([admin]);
    });

    it("takes the file's atmosphere, and keeps the hub's own place among the hubs", async () => {
        await connectTo(HUB, {userType: UserTypeEnumMap.Admin});

        await ServerRoomManager.loadRoomFile(HUB, readSourceFile());

        expect(RoomPrefsUtil.decode(getRoom().prefs)).toEqual({...RoomPrefsUtil.decode(SOURCE_PREFS),
            initialJoinPriority: HUB_INITIAL_JOIN_PRIORITY});
        expect(harness.HubRoomUtil.initialJoinPriorityByHubRoomID[HUB]).toBe(HUB_INITIAL_JOIN_PRIORITY);
    });

    it("keeps the players in the room, and has each arrive behind one of the file's doors", async () => {
        const admin = await connectTo(HUB, {userType: UserTypeEnumMap.Admin, playerMetadata: {"0": "hello"}});
        const visitor = await connectTo(HUB);
        const room = getRoom();
        const playersBefore = [admin, visitor].map(user => harness.getPlayerObject(user.user.id)!);
        const positionsBefore = playersBefore.map(player => ({...player.transform.pos}));

        await ServerRoomManager.loadRoomFile(HUB, readSourceFile());

        // The file's own passing objects never came along, so the room's players are the only ones in it.
        expect(Object.values(room.objectById).filter(obj => !isPersistent(obj))).toHaveLength(2);
        const spawnTransform = SpawnHotspotUtil.pickSpawnTransform(room, "");
        [admin, visitor].forEach((user, i) => {
            const player = harness.getPlayerObject(user.user.id)!;
            expect(player).toBe(playersBefore[i]);
            expect(room.objectById[player.objectId]).toBe(player);
            expect(player.transform.pos).toEqual(spawnTransform.pos);
            expect(player.transform.pos).not.toEqual(positionsBefore[i]);
            expect(PhysicsManager.hasObject(HUB, player.objectId)).toBe(true);
        });
        expect(harness.getPlayerMetadata(admin.user.id)).toEqual({"0": "hello"});
        expect(harness.getRoomParticipantCount(HUB)).toBe(2);
        checkInvariants([admin, visitor]);
    });

    it("rebuilds the room's physics on the new voxels and objects", async () => {
        const admin = await connectTo(HUB, {userType: UserTypeEnumMap.Admin});
        const room = getRoom();
        const physicsRoomBefore = PhysicsManager.physicsRooms[HUB];

        await ServerRoomManager.loadRoomFile(HUB, readSourceFile());

        const physicsRoom = PhysicsManager.physicsRooms[HUB];
        expect(physicsRoom).not.toBe(physicsRoomBefore);
        expect(physicsRoom.voxels.every((physicsVoxel, i) => physicsVoxel.voxel === room.voxelGrid.voxels[i]))
            .toBe(true);

        // Nothing of the old room is left in it, and the player collides where it now stands.
        expect(Object.keys(physicsRoom.objectById).every(objectId => room.objectById[objectId] != undefined))
            .toBe(true);
        expect(PhysicsManager.hasObject(HUB, ENTRANCE_DOOR_OBJECT_ID)).toBe(true);
        const player = harness.getPlayerObject(admin.user.id)!;
        expect(physicsRoom.objectById[player.objectId].colliderState.hitbox.center).toEqual(player.transform.pos);
    });

    it("stores the settings, then the contents, at once", async () => {
        await connectTo(HUB, {userType: UserTypeEnumMap.Admin});
        const room = getRoom();
        room.dirty = true;
        const lastSavedTimeBefore = ServerRoomManager.roomRuntimeMemories[HUB].lastSavedTimeInMillis = 0;

        expect(await ServerRoomManager.loadRoomFile(HUB, readSourceFile())).toBe(true);

        const changeRoomSettings = vi.mocked(DBRoomUtil.changeRoomSettings);
        const saveRoomContent = vi.mocked(DBRoomUtil.saveRoomContent);
        expect(changeRoomSettings).toHaveBeenCalledExactlyOnceWith(room, SOURCE_TEXTURE_PACK_PATH, room.prefs);
        expect(saveRoomContent).toHaveBeenCalledExactlyOnceWith(room);
        expect(changeRoomSettings.mock.invocationCallOrder[0])
            .toBeLessThan(saveRoomContent.mock.invocationCallOrder[0]);

        expect((await DBRoomUtil.getDBRoom(HUB))!.texturePackPath).toBe(SOURCE_TEXTURE_PACK_PATH);
        expect((await DBRoomUtil.getDBRoom(HUB))!.prefs).toBe(room.prefs);
        expect(room.dirty).toBe(false);
        expect(ServerRoomManager.roomRuntimeMemories[HUB].lastSavedTimeInMillis)
            .toBeGreaterThan(lastSavedTimeBefore);
    });

    it("holds the room's users from before anything is written until the room is sent again", async () => {
        const admin = await connectTo(HUB, {userType: UserTypeEnumMap.Admin});
        const visitor = await connectTo(HUB);
        harness.seedRoom("elsewhere", RoomTypeEnumMap.Regular);
        const outsider = await connectTo("elsewhere");
        flush(admin, visitor, outsider);

        // What each of the room's users had been told by the time each write began.
        const snapshots: {told: number, sentTheRoom: number}[] = [];
        const takeSnapshot = () => {
            for (const user of [admin, visitor])
            {
                snapshots.push({told: user.socket.getEmitted("roomReloadStarted").length,
                    sentTheRoom: getPendingSignals(user, "roomChangedSignal").length});
            }
        };
        vi.mocked(DBRoomUtil.changeRoomSettings).mockImplementationOnce(async () => { takeSnapshot(); return true; });
        vi.mocked(DBRoomUtil.saveRoomContent).mockImplementationOnce(async () => { takeSnapshot(); return true; });

        await ServerRoomManager.loadRoomFile(HUB, readSourceFile());

        expect(snapshots).toHaveLength(4);
        for (const snapshot of snapshots)
            expect(snapshot).toEqual({told: 1, sentTheRoom: 0});

        for (const user of [admin, visitor])
        {
            expect(user.socket.getEmitted("roomReloadStarted")).toHaveLength(1);
            expect(getPendingSignals(user, "roomChangedSignal")).toHaveLength(1);
        }
        expect(outsider.socket.getEmitted("roomReloadStarted")).toHaveLength(0);
        expect(getPendingSignals(outsider, "roomChangedSignal")).toHaveLength(0);
    });

    it("sends each user the whole new room, and nothing queued for the room as it was", async () => {
        const admin = await connectTo(HUB, {userType: UserTypeEnumMap.Admin});
        const visitor = await connectTo(HUB);
        flush(admin, visitor);

        // An edit to the old room that the visitor has not been sent yet.
        ServerVoxelManager.onAddVoxelBlockSignalReceived(admin.socketUserContext, new AddVoxelBlockSignal(HUB,
            VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(20, 20, COLLISION_LAYER_MIN),
            new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(0)));
        expect(getPendingSignals(visitor, "addVoxelBlockSignal")).toHaveLength(1);

        await ServerRoomManager.loadRoomFile(HUB, readSourceFile());

        expect(getPendingSignals(visitor, "addVoxelBlockSignal")).toHaveLength(0);
        const received = receiveRoom(visitor);
        expect(received.room.id).toBe(HUB);
        expect(received.room.texturePackPath).toBe(SOURCE_TEXTURE_PACK_PATH);
        expect(received.room.prefs).toBe(getRoom().prefs);
        expect(received.room.voxelGrid.restrictedZones).toEqual([SOURCE_ZONE]);
        expect(isBlockSolid(received.room.voxelGrid, SOURCE_BLOCK.row, SOURCE_BLOCK.col, COLLISION_LAYER_MIN))
            .toBe(true);
        expect(isBlockSolid(received.room.voxelGrid, 20, 20, COLLISION_LAYER_MIN)).toBe(false);
        expect(Object.keys(received.room.objectById).sort()).toEqual(Object.keys(getRoom().objectById).sort());
        expect(Object.keys(received.participantUserNameByID).sort())
            .toEqual([admin.user.id, visitor.user.id].sort());
    });

    it("gives a user who joined during the load the new room, once", async () => {
        const admin = await connectTo(HUB, {userType: UserTypeEnumMap.Admin});
        flush(admin);
        let latecomer!: ConnectedUser;
        vi.mocked(DBRoomUtil.changeRoomSettings).mockImplementationOnce(async () => {
            latecomer = await connectTo(HUB);
            return true;
        });

        await ServerRoomManager.loadRoomFile(HUB, readSourceFile());

        expect(latecomer.socket.getEmitted("roomReloadStarted")).toHaveLength(0);
        expect(receiveRoom(latecomer).room.texturePackPath).toBe(SOURCE_TEXTURE_PACK_PATH);
        const player = harness.getPlayerObject(latecomer.user.id)!;
        expect(getRoom().objectById[player.objectId]).toBe(player);
        checkInvariants([admin, latecomer]);
    });

    it("loads a file of older contents, which the room is then stored without", async () => {
        await connectTo(HUB, {userType: UserTypeEnumMap.Admin});
        const legacyObjects = new BufferState(new Uint8Array(1024));
        writeLegacyObjectGroup(legacyObjects, [], 0);
        const roomFile = fromBytes(concat(
            encodeString(SIGNATURE).slice(0, -1), [0],
            new Uint8Array(fs.readFileSync(path.join(__dirname, "../fixtures/legacyVoxelGrids/bare.bin"))),
            legacyObjects.view.subarray(0, legacyObjects.byteIndex),
            encodeString("default"),
            encodeString("")), HUB);

        expect(await ServerRoomManager.loadRoomFile(HUB, roomFile)).toBe(true);

        const stored = encodeStoredContent(vi.mocked(DBRoomUtil.saveRoomContent).mock.calls[0][0]);
        expect(stored[0]).toBe(VoxelGrid.latestFormatVersion);
        expect(stored[encodeVoxelGrid(getRoom().voxelGrid).length]).toBe(ObjectGroup.latestFormatVersion);
    });

    describe("when it cannot go through", () => {
        it("leaves the room as it was if the settings can't be stored, and still lets its users back", async () => {
            const admin = await connectTo(HUB, {userType: UserTypeEnumMap.Admin});
            const room = getRoom();
            const before = {voxelGrid: room.voxelGrid, objectGroup: room.objectGroup,
                texturePackPath: room.texturePackPath, prefs: room.prefs,
                playerPos: {...harness.getPlayerObject(admin.user.id)!.transform.pos}};
            flush(admin);
            vi.mocked(DBRoomUtil.changeRoomSettings).mockResolvedValueOnce(false);

            expect(await ServerRoomManager.loadRoomFile(HUB, readSourceFile())).toBe(false);

            expect(room.voxelGrid).toBe(before.voxelGrid);
            expect(room.objectGroup).toBe(before.objectGroup);
            expect(room.texturePackPath).toBe(before.texturePackPath);
            expect(room.prefs).toBe(before.prefs);
            expect(harness.getPlayerObject(admin.user.id)!.transform.pos).toEqual(before.playerPos);
            expect(DBRoomUtil.saveRoomContent).not.toHaveBeenCalled();

            expect(admin.socket.getEmitted("roomReloadStarted")).toHaveLength(1);
            expect(receiveRoom(admin).room.texturePackPath).toBe(before.texturePackPath);
            checkInvariants([admin]);
        });

        it("keeps the room dirty if its contents can't be stored, for the auto-save to retry", async () => {
            const admin = await connectTo(HUB, {userType: UserTypeEnumMap.Admin});
            flush(admin);
            vi.mocked(DBRoomUtil.saveRoomContent).mockResolvedValueOnce(false);

            expect(await ServerRoomManager.loadRoomFile(HUB, readSourceFile())).toBe(false);

            expect(getRoom().dirty).toBe(true);
            expect(getRoom().texturePackPath).toBe(SOURCE_TEXTURE_PACK_PATH);
            expect(receiveRoom(admin).room.texturePackPath).toBe(SOURCE_TEXTURE_PACK_PATH);
        });

        it("refuses a texture pack this build doesn't have, before anyone is told", async () => {
            const admin = await connectTo(HUB, {userType: UserTypeEnumMap.Admin});
            flush(admin);
            const roomFile = readSourceFile();
            roomFile.texturePackPath = "no-such-pack";

            expect(await ServerRoomManager.loadRoomFile(HUB, roomFile)).toBe(false);

            expect(admin.socket.getEmitted("roomReloadStarted")).toHaveLength(0);
            expect(getPendingSignals(admin, "roomChangedSignal")).toHaveLength(0);
            expect(DBRoomUtil.changeRoomSettings).not.toHaveBeenCalled();
            expect(DBRoomUtil.saveRoomContent).not.toHaveBeenCalled();
        });

        it("refuses a room that isn't loaded", async () => {
            harness.seedRoom("unvisited", RoomTypeEnumMap.Regular);

            expect(await ServerRoomManager.loadRoomFile("unvisited", readSourceFile("unvisited"))).toBe(false);
            expect(DBRoomUtil.changeRoomSettings).not.toHaveBeenCalled();
        });

        it("refuses a second file while one is still being loaded, and takes one again afterwards", async () => {
            const admin = await connectTo(HUB, {userType: UserTypeEnumMap.Admin});
            flush(admin);
            let finishFirstWrite!: (stored: boolean) => void;
            vi.mocked(DBRoomUtil.changeRoomSettings).mockImplementationOnce(
                () => new Promise<boolean>(resolve => { finishFirstWrite = resolve; }));

            const firstLoad = ServerRoomManager.loadRoomFile(HUB, readSourceFile());
            expect(await ServerRoomManager.loadRoomFile(HUB, readSourceFile())).toBe(false);

            // The refused one told nobody anything, and released nobody the first is still holding.
            expect(admin.socket.getEmitted("roomReloadStarted")).toHaveLength(1);
            expect(getPendingSignals(admin, "roomChangedSignal")).toHaveLength(0);
            expect(DBRoomUtil.changeRoomSettings).toHaveBeenCalledOnce();

            finishFirstWrite(true);
            expect(await firstLoad).toBe(true);
            expect(getPendingSignals(admin, "roomChangedSignal")).toHaveLength(1);

            expect(await ServerRoomManager.loadRoomFile(HUB, readSourceFile())).toBe(true);
        });

        it("still stores the file if the room empties and unloads during the load", async () => {
            const OWN_ROOM = "own-room";
            harness.seedRoom(OWN_ROOM, RoomTypeEnumMap.Regular);
            const admin = await connectTo(OWN_ROOM, {userType: UserTypeEnumMap.Admin, ownedRoomID: OWN_ROOM});
            const roomFile = readSourceFile(OWN_ROOM);
            vi.mocked(DBRoomUtil.changeRoomSettings).mockImplementationOnce(async () => {
                await harness.disconnectUser(admin);
                return true;
            });

            expect(await ServerRoomManager.loadRoomFile(OWN_ROOM, roomFile)).toBe(true);

            expect(harness.isRoomLoaded(OWN_ROOM)).toBe(false);
            expect(PhysicsManager.hasRoom(OWN_ROOM)).toBe(false);
            const lastStored = vi.mocked(DBRoomUtil.saveRoomContent).mock.lastCall![0];
            expect(lastStored.voxelGrid).toBe(roomFile.voxelGrid);
            expect(lastStored.texturePackPath).toBe(SOURCE_TEXTURE_PACK_PATH);
        });
    });
});
