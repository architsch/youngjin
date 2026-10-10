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
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import ObjectAttachmentUtil from "../../../src/shared/object/util/objectAttachmentUtil";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import QuarterTurnsUtil from "../../../src/shared/object/util/quarterTurnsUtil";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import Room from "../../../src/shared/room/types/room";
import RoomFile from "../../../src/shared/room/types/roomFile";
import { COLLISION_LAYER_HEIGHT, DIR_VEC_BY_NAME, OBJECT_NAME_MAX_LENGTH, STOREY_FLOOR_COLLISION_LAYER,
    UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";
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

    it("go with a block they stand on", async () => {
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
