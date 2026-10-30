/**
 * Scenario tests: NPCs (characters an admin stands on a floor; see NpcObjectTypeConfig) — who may lay and edit
 * one, where one may stand, the body its collider gives it, what it takes with a block, and that the room keeps it.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_HUB, EMPTY_REGULAR, userAtCenter } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import ObjectCategoryConfigMap from "../../../src/shared/object/maps/objectCategoryConfigMap";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import NpcObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/npcObjectTypeConfig";
import BehaviorPrefs from "../../../src/shared/object/types/behaviorPrefs";
import BehaviorPrefsUtil, { LONGEST_IDLE_TIME, MAX_WANDER_RADIUS,
    SHORTEST_IDLE_TIME } from "../../../src/shared/object/util/behaviorPrefsUtil";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import BufferState from "../../../src/shared/networking/types/bufferState";
import { writeLegacyObjectGroup } from "../helpers/legacyObjectGroup";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import ObjectAttachmentUtil from "../../../src/shared/object/util/objectAttachmentUtil";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import QuarterTurnsUtil from "../../../src/shared/object/util/quarterTurnsUtil";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import Room from "../../../src/shared/room/types/room";
import RoomFile from "../../../src/shared/room/types/roomFile";
import { COLLISION_LAYER_HEIGHT, DIR_VEC_BY_NAME, NPC_MESSAGE_MAX_LENGTH, OBJECT_MESSAGE_MAX_LENGTH,
    OBJECT_NAME_MAX_LENGTH, STOREY_FLOOR_COLLISION_LAYER, UNIT_VEC3,
    VOXEL_CELL_SIZE } from "../../../src/shared/system/sharedConstants";
import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";

const npcTypeIndex = ObjectTypeConfigMap.getIndexByType("Npc");

const ADMIN = new User("an-admin", "Admin", UserTypeEnumMap.Admin, "admin@test.com", "");
const MEMBER = new User("a-member", "Member", UserTypeEnumMap.Member, "member@test.com", "");
const GUEST = new User("a-guest", "Guest", UserTypeEnumMap.Guest, "guest@test.com", "");
// The owner of the regular fixture room.
const OWNER = new User("an-owner", "Owner", UserTypeEnumMap.Member, "owner@test.com", "", "", "regular");

// The step of the grid an attached object is placed on across its face: half a block (see ObjectAttachmentUtil).
const GRID_STEP = 0.5 * VOXEL_CELL_SIZE;

// The middle of a voxel well inside the room, and the voxel itself.
const SPOT = {x: 10.25, z: 10.25};
const SPOT_ROW = VoxelQueryUtil.getVoxelRowFromWorldZ(SPOT.z);
const SPOT_COL = VoxelQueryUtil.getVoxelColFromWorldX(SPOT.x);

// Standing at the spot, on a floor at the given height.
function makeNpcSignal(room: Room, sourceUser: User, floorY: number = 0, objectId: string = "an-npc",
    dir = DIR_VEC_BY_NAME["+y"]): AddObjectSignal
{
    return new AddObjectSignal(room.id, sourceUser.id, sourceUser.userName, npcTypeIndex, objectId,
        new ObjectTransform({x: SPOT.x, y: floorY, z: SPOT.z}, {...dir}, {...UNIT_VEC3}),
        {[ObjectMetadataKeyEnumMap.Label]: new EncodableByteString("Receptionist")});
}

function setBlock(room: Room, layer: number, present: boolean): void
{
    const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(SPOT_ROW, SPOT_COL, layer);
    if (present)
        expect(VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels, quadIndex)).toBe(true);
    else
        expect(VoxelUpdateUtil.removeVoxelBlock(undefined, room.voxelGrid.voxels, quadIndex)).toBe(true);
}

describe("NPCs", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("are an admin's alone to lay, in a hub or in somebody's own room", async () => {
        await runScenario({
            name: "laying an NPC",
            rooms: [EMPTY_HUB, EMPTY_REGULAR],
            users: [userAtCenter("hub"), userAtCenter("regular")],
            assertions: () => {
                for (const roomID of ["hub", "regular"])
                {
                    const room = ServerRoomManager.roomRuntimeMemories[roomID].room;
                    const canAdd = (user: User) => ObjectUpdateUtil.canAddObject(user, room, makeNpcSignal(room, user));
                    expect(canAdd(ADMIN), roomID).toBe(true);
                    expect(canAdd(MEMBER), roomID).toBe(false);
                    expect(canAdd(GUEST), roomID).toBe(false);
                    expect(canAdd(OWNER), roomID).toBe(false);
                    // Nor under somebody else's name.
                    expect(ObjectUpdateUtil.canAddObject(ADMIN, room, makeNpcSignal(room, MEMBER)), roomID).toBe(false);
                }
            },
        });
    });

    it("stand on floors only: never on a wall or under a ceiling", async () => {
        await runScenario({
            name: "where an NPC faces",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                expect(ObjectAttachmentUtil.allowsFacing(npcTypeIndex, DIR_VEC_BY_NAME["+y"])).toBe(true);
                for (const facing of ["-y", "+x", "-x", "+z", "-z"])
                {
                    expect(ObjectAttachmentUtil.allowsFacing(npcTypeIndex, DIR_VEC_BY_NAME[facing]), facing).toBe(false);
                    expect(ObjectUpdateUtil.canAddObject(ADMIN, room,
                        makeNpcSignal(room, ADMIN, 0, "an-npc", DIR_VEC_BY_NAME[facing])), facing).toBe(false);
                }
            },
        });
    });

    it("need room for their whole body over the floor they stand on", async () => {
        await runScenario({
            name: "headroom for an NPC",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const canStand = () => ObjectUpdateUtil.canAddObject(ADMIN, room, makeNpcSignal(room, ADMIN));
                const numBodyLayers = Math.ceil(PLAYER_HEIGHT / COLLISION_LAYER_HEIGHT);
                expect(canStand()).toBe(true);

                // A block anywhere up its height is in its way; one just over its head is not.
                for (const layer of [1, numBodyLayers - 1])
                {
                    setBlock(room, layer, true);
                    expect(canStand(), `a block at layer ${layer}`).toBe(false);
                    setBlock(room, layer, false);
                }
                setBlock(room, numBodyLayers, true);
                expect(canStand()).toBe(true);
            },
        });
    });

    it("need a floor under their feet", async () => {
        await runScenario({
            name: "a floor for an NPC",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                // On the slab between the storeys, which is blocks rather than the room's own floor.
                const upperFloorY = (STOREY_FLOOR_COLLISION_LAYER + 1) * COLLISION_LAYER_HEIGHT;
                const canStand = () => ObjectUpdateUtil.canAddObject(ADMIN, room,
                    makeNpcSignal(room, ADMIN, upperFloorY));
                expect(canStand()).toBe(true);

                // In mid-air, half a layer up, it can't; nor once a block under its feet is gone.
                expect(ObjectUpdateUtil.canAddObject(ADMIN, room,
                    makeNpcSignal(room, ADMIN, upperFloorY + 2 * COLLISION_LAYER_HEIGHT))).toBe(false);
                setBlock(room, STOREY_FLOOR_COLLISION_LAYER, false);
                expect(canStand()).toBe(false);
            },
        });
    });

    it("have a player's body, standing on the floor from its feet up", async () => {
        await runScenario({
            name: "an NPC's body",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const npc = makeNpcSignal(room, ADMIN);
                expect(ObjectUpdateUtil.addObject(ADMIN, room, npc)).toBe(true);

                const {hitbox, colliderConfig} = PhysicsColliderStateUtil.getObjectColliderState(npcTypeIndex, npc.transform)!;
                expect(hitbox.center.x).toBeCloseTo(SPOT.x, 6);
                expect(hitbox.center.z).toBeCloseTo(SPOT.z, 6);
                // From the floor to a player's height, not astride the floor.
                expect(hitbox.center.y - hitbox.halfSize.y).toBeCloseTo(0, 6);
                expect(hitbox.center.y + hitbox.halfSize.y).toBeCloseTo(PLAYER_HEIGHT, 6);
                expect(hitbox.halfSize.x).toBeLessThanOrEqual(PLAYER_RADIUS_XZ);
                expect(hitbox.halfSize.x).toBeGreaterThan(0.9 * PLAYER_RADIUS_XZ);
                expect(hitbox.halfSize.z).toBe(hitbox.halfSize.x);
                // Walked round rather than into.
                expect(colliderConfig.applyHardCollisionToOthers).toBe(false);
            },
        });
    });

    it("rest on the blocks they stand on", async () => {
        await runScenario({
            name: "the block under an NPC",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const upperFloorY = (STOREY_FLOOR_COLLISION_LAYER + 1) * COLLISION_LAYER_HEIGHT;
                expect(ObjectUpdateUtil.addObject(ADMIN, room, makeNpcSignal(room, ADMIN, upperFloorY))).toBe(true);

                const attachedTo = (row: number, col: number, layer: number) =>
                    ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room,
                        VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, layer));
                expect(attachedTo(SPOT_ROW, SPOT_COL, STOREY_FLOOR_COLLISION_LAYER)).toEqual(["an-npc"]);
                // Not with one further off, nor with one under the slab.
                expect(attachedTo(SPOT_ROW, SPOT_COL + 3, STOREY_FLOOR_COLLISION_LAYER)).toEqual([]);
                expect(attachedTo(SPOT_ROW + 3, SPOT_COL, STOREY_FLOOR_COLLISION_LAYER)).toEqual([]);
            },
        });
    });

    // A browser moves a helper's collider along the walk it is shown, and the server keeps it at home: answered by
    // their colliders, the two would disagree over the block under its home, which the server would then refuse to
    // remove every time the browser saw nothing on it.
    it("rest on the blocks under where their room keeps them, and take up that room, wherever a helper is shown",
        async () => {
        await runScenario({
            name: "a helper's home",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const upperFloorY = (STOREY_FLOOR_COLLISION_LAYER + 1) * COLLISION_LAYER_HEIGHT;
                const npc = makeNpcSignal(room, ADMIN, upperFloorY);
                expect(ObjectUpdateUtil.addObject(ADMIN, room, npc)).toBe(true);
                const homeBlock = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(SPOT_ROW, SPOT_COL,
                    STOREY_FLOOR_COLLISION_LAYER);
                const shownAt = new ObjectTransform({x: SPOT.x + 3, y: upperFloorY, z: SPOT.z},
                    {...DIR_VEC_BY_NAME["+y"]}, {...UNIT_VEC3});
                PhysicsManager.setObjectTransform(room.id, npc.objectId, shownAt, true);

                expect(ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, homeBlock)).toEqual([npc.objectId]);
                expect(VoxelUpdateUtil.canRemoveVoxelBlock(ADMIN, room, homeBlock)).toBe(false);
                expect(ObjectAttachmentUtil.canPlaceObject(room, "another-npc", npcTypeIndex, npc.transform)).toBe(false);
                expect(ObjectAttachmentUtil.canPlaceObject(room, "another-npc", npcTypeIndex, shownAt)).toBe(true);
            },
        });
    });

    it("step to the nearest floor that takes them as the block they stand on goes, or drop to one further down, for "
        + "whoever may move them", async () => {
        await runScenario({
            name: "an NPC stepping aside",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const accepts = (user: User, obj: AddObjectSignal) => (tr: ObjectTransform) =>
                    ObjectUpdateUtil.canSetObjectTransform(user, room, new SetObjectTransformSignal(room.id, obj.objectId,
                        tr, true));
                // On the slab, with the block under its middle taken: beside it, on the same floor, as the server takes
                // the move and then the block.
                const upperFloorY = (STOREY_FLOOR_COLLISION_LAYER + 1) * COLLISION_LAYER_HEIGHT;
                const onSlab = makeNpcSignal(room, ADMIN, upperFloorY, "on-the-slab");
                expect(ObjectUpdateUtil.addObject(ADMIN, room, onSlab)).toBe(true);
                const underItsMiddle = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(SPOT_ROW, SPOT_COL,
                    STOREY_FLOOR_COLLISION_LAYER);
                expect(ObjectAttachmentUtil.findSpotSteppingAside(room, onSlab, underItsMiddle, accepts(GUEST, onSlab)))
                    .toBeUndefined();
                const stepped = ObjectAttachmentUtil.findSpotSteppingAside(room, onSlab, underItsMiddle,
                    accepts(ADMIN, onSlab))!;
                expect(stepped.pos.y).toBe(upperFloorY);
                // The least step that takes a footprint as wide as an NPC's, from over a block's middle, off that block.
                expect(Math.hypot(stepped.pos.x - SPOT.x, stepped.pos.z - SPOT.z)).toBeCloseTo(3 * GRID_STEP, 6);
                expect(ObjectUpdateUtil.setObjectTransform(ADMIN, room,
                    new SetObjectTransformSignal(room.id, onSlab.objectId, stepped, true)).desyncDetected).toBe(false);
                expect(VoxelUpdateUtil.removeVoxelBlock(ADMIN, room.voxelGrid.voxels, underItsMiddle, room)).toBe(true);

                // On a platform just wide enough for it, nowhere on top is clear of the block, and there is none a step
                // up: it drops to the floor beside the platform.
                const platformRow = SPOT_ROW + 20, platformCol = SPOT_COL + 20;
                for (let row = platformRow - 1; row <= platformRow + 1; ++row)
                {
                    for (let col = platformCol - 1; col <= platformCol + 1; ++col)
                    {
                        for (const layer of [0, 1])
                        {
                            expect(VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels,
                                VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, layer))).toBe(true);
                        }
                    }
                }
                const platformMiddle = {x: VoxelQueryUtil.getWorldXAtVoxelColCenter(platformCol),
                    z: VoxelQueryUtil.getWorldZAtVoxelRowCenter(platformRow)};
                const onPlatform = new AddObjectSignal(room.id, ADMIN.id, ADMIN.userName, npcTypeIndex, "on-the-platform",
                    new ObjectTransform({x: platformMiddle.x, y: 2 * COLLISION_LAYER_HEIGHT, z: platformMiddle.z},
                        {...DIR_VEC_BY_NAME["+y"]}, {...UNIT_VEC3}),
                    {[ObjectMetadataKeyEnumMap.Label]: new EncodableByteString("Lookout")});
                expect(ObjectUpdateUtil.addObject(ADMIN, room, onPlatform)).toBe(true);
                const dropped = ObjectAttachmentUtil.findSpotSteppingAside(room, onPlatform,
                    VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(platformRow, platformCol, 1), accepts(ADMIN, onPlatform))!;
                expect(dropped.pos.y).toBe(0);
                // Clear of the platform's three columns, by the least a footprint as wide as an NPC's needs.
                expect(Math.hypot(dropped.pos.x - platformMiddle.x, dropped.pos.z - platformMiddle.z))
                    .toBeCloseTo(5 * GRID_STEP, 6);
            },
        });
    });

    it("take a short name, their looks and the way they face from an admin, and nothing from anybody else", async () => {
        await runScenario({
            name: "editing an NPC",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const npc = makeNpcSignal(room, ADMIN);
                expect(ObjectUpdateUtil.addObject(ADMIN, room, npc)).toBe(true);
                const canSet = (user: User, key: number, value: string) => ObjectUpdateUtil.canSetObjectMetadata(
                    user, room, new SetObjectMetadataSignal(room.id, npc.objectId, key, value));

                expect(canSet(ADMIN, ObjectMetadataKeyEnumMap.Label, "Guide")).toBe(true);
                expect(canSet(ADMIN, ObjectMetadataKeyEnumMap.Label, "g".repeat(OBJECT_NAME_MAX_LENGTH))).toBe(true);
                expect(canSet(ADMIN, ObjectMetadataKeyEnumMap.Label, "g".repeat(OBJECT_NAME_MAX_LENGTH + 1))).toBe(false);
                expect(canSet(ADMIN, ObjectMetadataKeyEnumMap.QuarterTurns, QuarterTurnsUtil.encode(1))).toBe(true);
                expect(canSet(ADMIN, ObjectMetadataKeyEnumMap.InstancedMeshComposition, "\"!!!\"!!!&&---\"")).toBe(true);
                expect(canSet(ADMIN, ObjectMetadataKeyEnumMap.SentMessage, "Hello!")).toBe(false);
                expect(canSet(ADMIN, ObjectMetadataKeyEnumMap.DestinationRoomId, "hub")).toBe(false);
                for (const user of [MEMBER, GUEST])
                {
                    expect(canSet(user, ObjectMetadataKeyEnumMap.Label, "Guide")).toBe(false);
                    expect(canSet(user, ObjectMetadataKeyEnumMap.QuarterTurns, QuarterTurnsUtil.encode(1))).toBe(false);
                }

                // One with too long a name is never laid either.
                const longNamed = makeNpcSignal(room, ADMIN, 0, "another-npc");
                longNamed.transform.pos.x += 3;
                expect(ObjectUpdateUtil.canAddObject(ADMIN, room, longNamed)).toBe(true);
                longNamed.metadata[ObjectMetadataKeyEnumMap.Label] =
                    new EncodableByteString("g".repeat(OBJECT_NAME_MAX_LENGTH + 1));
                expect(ObjectUpdateUtil.canAddObject(ADMIN, room, longNamed)).toBe(false);
            },
        });
    });

    it("take how they are played (character, how far they wander, whether they climb, whether home holds them, how long "
        + "they idle) from an admin alone, as the nearest it can be", async () => {
        await runScenario({
            name: "setting how an NPC is played",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const npc = makeNpcSignal(room, ADMIN);
                expect(ObjectUpdateUtil.addObject(ADMIN, room, npc)).toBe(true);
                const set = (user: User, value: string) => ObjectUpdateUtil.setObjectMetadata(user, room,
                    new SetObjectMetadataSignal(room.id, npc.objectId, ObjectMetadataKeyEnumMap.BehaviorPrefs, value));
                const stored = () => room.objectById[npc.objectId].metadata[ObjectMetadataKeyEnumMap.BehaviorPrefs]?.str;
                const prefs = () => BehaviorPrefsUtil.getObjectPrefs(room.objectById[npc.objectId]);
                const encode = (changed: Partial<BehaviorPrefs>) =>
                    BehaviorPrefsUtil.encode({...BehaviorPrefsUtil.decode(""), ...changed});

                // Until an admin says otherwise, a guide going a little way on its own floor now and then, and home
                // after each wander.
                expect(prefs()).toEqual({personality: "guide", wanderRadius: 3, canClimb: false, anchoredToHome: true,
                    minIdleTime: 20, maxIdleTime: LONGEST_IDLE_TIME});

                for (const user of [MEMBER, GUEST])
                    expect(set(user, encode({personality: "jester"}))).toBe(false);
                expect(stored()).toBeUndefined();

                const wanted: BehaviorPrefs = {personality: "storyteller", wanderRadius: MAX_WANDER_RADIUS, canClimb: true,
                    anchoredToHome: false, minIdleTime: SHORTEST_IDLE_TIME, maxIdleTime: 4};
                expect(set(ADMIN, encode(wanted))).toBe(true);
                expect(prefs()).toEqual(wanted);
                expect(stored()).toHaveLength(6);

                // Whatever else is given is kept as the nearest it can be: a radius past the farthest as the farthest,
                // a character there is none of as a guide, idle times outside the range at its ends and the wrong way
                // round the right way, and nothing as the defaults.
                const unknownCharacter = String.fromCharCode(33 + 90) + encode({}).slice(1);
                for (const [given, kept] of [[encode({wanderRadius: 99}), {wanderRadius: MAX_WANDER_RADIUS}],
                    [encode({wanderRadius: 2.4}), {wanderRadius: 2}], [unknownCharacter, {}], ["", {}],
                    [encode({minIdleTime: 0, maxIdleTime: 99}), {minIdleTime: SHORTEST_IDLE_TIME,
                        maxIdleTime: LONGEST_IDLE_TIME}],
                    [encode({minIdleTime: 12, maxIdleTime: 5}), {minIdleTime: 5, maxIdleTime: 12}],
                    [encode({minIdleTime: 7.6}), {minIdleTime: 8}],
                    ["~~~~~~~~", {wanderRadius: MAX_WANDER_RADIUS, canClimb: true, minIdleTime: LONGEST_IDLE_TIME}]] as
                    [string, Partial<BehaviorPrefs>][])
                {
                    expect(set(ADMIN, given)).toBe(true);
                    expect(stored(), given).toBe(encode(kept));
                }
                // And read so, as a stored value that was never made the nearest is.
                expect(BehaviorPrefsUtil.decode("!~").wanderRadius).toBe(MAX_WANDER_RADIUS);
            },
        });
    });

    it("keep the wander radius and character they were played with before BehaviorPrefs, as rooms stored them", () => {
        // The keys a helper's settings were kept under: its wander radius as the number itself, and its character by id.
        const [legacyWanderRadius, legacyPersonality] = [19, 20];
        const stood = (objectTypeIndex: number, objectId: string, values: {[key: number]: string}) =>
            new AddObjectSignal("room", "admin", "Admin", objectTypeIndex, objectId,
                new ObjectTransform({x: 10, y: 0, z: 10}, {...DIR_VEC_BY_NAME["+y"]}, {...UNIT_VEC3}),
                Object.fromEntries(Object.entries(values).map(([key, value]) => [key, new EncodableByteString(value)])));
        const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
        const view = new Uint8Array(16 * 1024);
        const writeState = new BufferState(view);
        writeLegacyObjectGroup(writeState, [
            stood(npcTypeIndex, "set", {[legacyWanderRadius]: "8", [legacyPersonality]: "jester"}),
            stood(npcTypeIndex, "idle", {[legacyPersonality]: "idle"}),
            stood(npcTypeIndex, "plain", {}),
            stood(npcTypeIndex, "odd", {[legacyWanderRadius]: "far", [legacyPersonality]: "pirate"}),
            stood(lampTypeIndex, "lamp", {[legacyWanderRadius]: "5"}),
        ], 8);

        const group = ObjectGroup.decodeWithParams(new BufferState(view.subarray(0, writeState.byteIndex)), "room") as
            ObjectGroup;
        expect(group.sourceFormatVersion).toBe(8);
        const prefsOf = (objectId: string) => BehaviorPrefsUtil.getObjectPrefs(group.objectById[objectId]);
        const defaults = BehaviorPrefsUtil.decode("");
        expect(prefsOf("set")).toEqual({...defaults, personality: "jester", wanderRadius: 8});
        expect(prefsOf("idle")).toEqual({...defaults, personality: "idle"});
        expect(prefsOf("odd")).toEqual(defaults);
        expect(group.objectById["plain"].metadata[ObjectMetadataKeyEnumMap.BehaviorPrefs]).toBeUndefined();
        expect(group.objectById["lamp"].metadata[ObjectMetadataKeyEnumMap.BehaviorPrefs]).toBeUndefined();
        for (const obj of Object.values(group.objectById))
        {
            expect(obj.metadata[legacyWanderRadius], obj.objectId).toBeUndefined();
            expect(obj.metadata[legacyPersonality], obj.objectId).toBeUndefined();
        }
    });

    it("say more than a player may, as the server or a room's script has them, kept whole by whoever is shown it",
        async () => {
        await runScenario({
            name: "an NPC's long line",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const npc = makeNpcSignal(room, ADMIN);
                expect(ObjectUpdateUtil.addObject(ADMIN, room, npc)).toBe(true);
                // As a browser applies what the server shows it (see ClientObjectManager.setObjectMetadata).
                const show = (text: string) => {
                    ObjectUpdateUtil.setObjectMetadata(ADMIN, room, new SetObjectMetadataSignal(room.id, npc.objectId,
                        ObjectMetadataKeyEnumMap.SentMessage, text), false);
                    return room.objectById[npc.objectId].metadata[ObjectMetadataKeyEnumMap.SentMessage].str;
                };
                const longest = "a".repeat(NPC_MESSAGE_MAX_LENGTH);
                expect(NPC_MESSAGE_MAX_LENGTH).toBeGreaterThan(OBJECT_MESSAGE_MAX_LENGTH);
                expect(show(longest)).toBe(longest);
                expect(show(`${longest}b`)).toBe(longest);
            },
        });
    });

    it("are moved across floors and removed by an admin alone", async () => {
        await runScenario({
            name: "moving an NPC",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const npc = makeNpcSignal(room, ADMIN);
                expect(ObjectUpdateUtil.addObject(ADMIN, room, npc)).toBe(true);
                const moved = new ObjectTransform({x: SPOT.x + 2, y: 0, z: SPOT.z + 1}, DIR_VEC_BY_NAME["+y"], {...UNIT_VEC3});
                const canMove = (user: User, ignorePhysics: boolean) => ObjectUpdateUtil.canSetObjectTransform(user, room,
                    new SetObjectTransformSignal(room.id, npc.objectId, moved, ignorePhysics));
                const canRemove = (user: User) => ObjectUpdateUtil.canRemoveObject(user, room,
                    new RemoveObjectSignal(room.id, npc.objectId));

                expect(canMove(ADMIN, true)).toBe(true);
                expect(canMove(ADMIN, false)).toBe(false); // a placement, never a push
                expect(canMove(MEMBER, true)).toBe(false);
                expect(canRemove(ADMIN)).toBe(true);
                expect(canRemove(MEMBER)).toBe(false);
                expect(canRemove(GUEST)).toBe(false);
            },
        });
    });

    it("are kept with the room, and counted apart from its players", async () => {
        await runScenario({
            name: "an NPC in the room's content",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const numPlayers = room.objectGroup.getCategoryCount("Player");
                expect(numPlayers).toBeGreaterThan(0);
                expect(ObjectUpdateUtil.addObject(ADMIN, room, makeNpcSignal(room, ADMIN))).toBe(true);

                expect(NpcObjectTypeConfig.persistent).toBe(true);
                expect(room.dirty).toBe(true);
                expect(Object.keys(RoomFile.fromRoom(room).objectGroup.objectById)).toContain("an-npc");
                expect(room.objectGroup.getCategoryCount("Player")).toBe(numPlayers);
                expect(room.objectGroup.getCategoryCount("Npc")).toBe(1);
                expect(ObjectCategoryConfigMap.getMaxCountPerRoom("Npc")).toBeGreaterThan(0);
            },
        });
    });
});
