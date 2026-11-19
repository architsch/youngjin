/**
 * Scenario tests: ghost mode, kept in a player's AdminPrefs metadata (see @docs/gameplay/admin.md).
 * Covers: the AdminPrefs codec, admin-only permission on one's own player, relay, persistence across
 * sessions (including a stored value outliving a demotion), and, through the real physics engine, a ghost and other
 * players passing through each other while everything else still collides with the ghost.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { getPendingSignals } from "../helpers/invariants";
import { regularRoom, roomWithWall, namedUser, disconnectWithSave } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import AdminPrefsUtil from "../../../src/shared/object/util/adminPrefsUtil";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import { PLAYER_HEIGHT, PLAYER_MAX_WALK_INPUT, PLAYER_RADIUS_XZ,
    PLAYER_WALK_SPEED_PER_INPUT } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import Room from "../../../src/shared/room/types/room";
import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import Vec3 from "../../../src/shared/math/types/vec3";
import { UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";

const ADMIN_PREFS_KEY = ObjectMetadataKeyEnumMap.AdminPrefs;
const GHOST_ON = AdminPrefsUtil.encode({ghostMode: true});
const GHOST_OFF = AdminPrefsUtil.encode({ghostMode: false});

const STANDING_Y = 0.5 * PLAYER_HEIGHT;
const FRAME = 1 / 60;
const WALKING_SPEED = PLAYER_WALK_SPEED_PER_INPUT * PLAYER_MAX_WALK_INPUT;
// Places to stand on the floor, clear of the room's entrance and of each other, and a column of blocks.
const SPOT: Vec3 = {x: 8, y: STANDING_Y, z: 8};
const OVER_FAN: Vec3 = {x: 24, y: STANDING_Y, z: 8};
const COLUMN_ROW = 40;
const COLUMN_COL = 32;

function standingAt(pos: Vec3): ObjectTransform
{
    return new ObjectTransform({...pos}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3});
}

// Puts a body down at once with its middle here, as a test may and a person may not.
function standAt(room: Room, objectId: string, pos: Vec3): void
{
    PhysicsManager.setObjectTransform(room.id, objectId, standingAt(pos), true);
}

// One step of a body as a browser's Rigidbody or the server, for an agent, takes it: the walking step, then the move
// through the real collisions. Returns where its middle ends up.
function step(room: Room, objectId: string, pos: Vec3, steering: Vec3): Vec3
{
    const velocity = PhysicsManager.getStepVelocity(room.id, objectId, steering, FRAME).velocity;
    return PhysicsManager.setObjectTransform(room.id, objectId, standingAt({x: pos.x + velocity.x * FRAME,
        y: pos.y + velocity.y * FRAME, z: pos.z + velocity.z * FRAME}), false).transform.pos;
}

// How fast the walking step moves a body that stands still across the floor: whatever pushes it.
function pushOn(room: Room, objectId: string): number
{
    const velocity = PhysicsManager.getStepVelocity(room.id, objectId, {x: 0, y: 0, z: 0}, FRAME).velocity;
    return Math.hypot(velocity.x, velocity.z);
}

// An object laid on the room's floor under a place to stand, as the room keeps it.
function layOnFloor(user: User, room: Room, objectId: string, objectType: string, under: Vec3): void
{
    expect(ObjectUpdateUtil.addObject(user, room, new AddObjectSignal(room.id, user.id, user.userName,
        ObjectTypeConfigMap.getIndexByType(objectType), objectId,
        new ObjectTransform({x: under.x, y: 0, z: under.z}, {x: 0, y: 1, z: 0}, {...UNIT_VEC3})), false)).toBe(true);
}

describe("ghost mode", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    // ─── Codec ─────────────────────────────────────────────────────────

    it("an object without admin prefs is not a ghost", () => {
        expect(AdminPrefsUtil.decode("").ghostMode).toBe(false);
    });

    it("ghost mode round-trips through a single base-94 character", () => {
        expect(GHOST_ON.length).toBe(1);
        expect(GHOST_OFF.length).toBe(1);
        expect(GHOST_ON).not.toBe(GHOST_OFF);
        expect(AdminPrefsUtil.decode(GHOST_ON).ghostMode).toBe(true);
        expect(AdminPrefsUtil.decode(GHOST_OFF).ghostMode).toBe(false);
    });

    it("untrusted input canonicalizes to a valid value", () => {
        for (const raw of ["", " ", "~~~~", "\u0000", "😀", "!extra"])
            expect([GHOST_ON, GHOST_OFF]).toContain(AdminPrefsUtil.canonicalize(raw));
    });

    // ─── Permissions ───────────────────────────────────────────────────

    it("an admin can turn ghost mode on for their own player", async () => {
        await runScenario({
            name: "admin ghost on",
            rooms: [regularRoom("ghost-admin")],
            users: [namedUser("ghost-admin-user", "ghost-admin", {userType: UserTypeEnumMap.Admin})],
            actions: [
                { type: "setObjectMetadata", userIndex: 0, metadataKey: ADMIN_PREFS_KEY, metadataValue: GHOST_ON },
            ],
            assertions: ({ harness }) => {
                const obj = harness.getPlayerObject("ghost-admin-user");
                expect(obj!.metadata[ADMIN_PREFS_KEY]?.str).toBe(GHOST_ON);
                expect(AdminPrefsUtil.getObjectPrefs(obj!).ghostMode).toBe(true);
            },
        });
    });

    it("an admin can turn ghost mode off again", async () => {
        await runScenario({
            name: "admin ghost off",
            rooms: [regularRoom("ghost-admin-off")],
            users: [namedUser("ghost-admin-off-user", "ghost-admin-off", {
                userType: UserTypeEnumMap.Admin,
                playerMetadata: { [String(ADMIN_PREFS_KEY)]: GHOST_ON },
            })],
            actions: [
                { type: "setObjectMetadata", userIndex: 0, metadataKey: ADMIN_PREFS_KEY, metadataValue: GHOST_OFF },
            ],
            assertions: ({ harness }) => {
                const obj = harness.getPlayerObject("ghost-admin-off-user");
                expect(AdminPrefsUtil.getObjectPrefs(obj!).ghostMode).toBe(false);
            },
        });
    });

    for (const [roleName, userType] of [["member", UserTypeEnumMap.Member], ["guest", UserTypeEnumMap.Guest]] as const)
    {
        it(`a ${roleName} cannot put their own player in ghost mode`, async () => {
            await runScenario({
                name: `${roleName} ghost rejected`,
                rooms: [regularRoom(`ghost-${roleName}`)],
                users: [namedUser(`ghost-${roleName}-user`, `ghost-${roleName}`, {userType})],
                actions: [
                    { type: "setObjectMetadata", userIndex: 0, metadataKey: ADMIN_PREFS_KEY, metadataValue: GHOST_ON },
                ],
                assertions: ({ users, harness }) => {
                    const obj = harness.getPlayerObject(`ghost-${roleName}-user`);
                    expect(obj!.metadata[ADMIN_PREFS_KEY]).toBeUndefined();
                    // The rejection is corrected back to the sender.
                    expect(getPendingSignals(users[0], "setObjectMetadataSignal").length).toBeGreaterThan(0);
                },
            });
        });
    }

    it("an admin cannot put another player in ghost mode", async () => {
        await runScenario({
            name: "foreign ghost rejected",
            rooms: [regularRoom("ghost-foreign")],
            users: [
                namedUser("ghost-foreign-admin", "ghost-foreign", {userType: UserTypeEnumMap.Admin}),
                namedUser("ghost-foreign-victim", "ghost-foreign"),
            ],
            actions: [
                { type: "setObjectMetadata", userIndex: 0, targetUserIndex: 1,
                    metadataKey: ADMIN_PREFS_KEY, metadataValue: GHOST_ON },
            ],
            assertions: ({ harness }) => {
                const victim = harness.getPlayerObject("ghost-foreign-victim");
                expect(victim!.metadata[ADMIN_PREFS_KEY]).toBeUndefined();
            },
        });
    });

    // ─── Relay ─────────────────────────────────────────────────────────

    it("entering ghost mode is relayed to the other participants", async () => {
        await runScenario({
            name: "ghost relay",
            rooms: [regularRoom("ghost-relay")],
            users: [
                namedUser("ghost-relay-admin", "ghost-relay", {userType: UserTypeEnumMap.Admin}),
                namedUser("ghost-relay-watcher", "ghost-relay"),
            ],
            actions: [
                { type: "setObjectMetadata", userIndex: 0, metadataKey: ADMIN_PREFS_KEY, metadataValue: GHOST_ON },
            ],
            assertions: ({ users }) => {
                const relayed = getPendingSignals(users[1], "setObjectMetadataSignal");
                expect(relayed.some((s: any) => s.metadataKey == ADMIN_PREFS_KEY)).toBe(true);
            },
        });
    });

    // ─── Persistence ───────────────────────────────────────────────────

    it("ghost mode survives reconnection", async () => {
        await runScenario({
            name: "ghost survives reconnect",
            rooms: [regularRoom("ghost-recon")],
            users: [namedUser("ghost-recon-user", "ghost-recon", {userType: UserTypeEnumMap.Admin})],
            actions: [
                { type: "setObjectMetadata", userIndex: 0, metadataKey: ADMIN_PREFS_KEY, metadataValue: GHOST_ON },
                { type: "reconnectCaseA", userIndex: 0 },
            ],
            assertions: ({ harness }) => {
                const obj = harness.getPlayerObject("ghost-recon-user");
                expect(obj!.metadata[ADMIN_PREFS_KEY]?.str).toBe(GHOST_ON);
            },
        });
    });

    it("ghost mode is saved to the user's stored player metadata on leaving", async () => {
        await runScenario({
            name: "ghost saved",
            rooms: [regularRoom("ghost-save")],
            users: [namedUser("ghost-save-user", "ghost-save", {userType: UserTypeEnumMap.Admin})],
            actions: [
                { type: "setObjectMetadata", userIndex: 0, metadataKey: ADMIN_PREFS_KEY, metadataValue: GHOST_ON },
                disconnectWithSave(0),
            ],
            skipInvariants: true,
            assertions: ({ harness }) => {
                expect(harness.getStoredPlayerMetadata("ghost-save-user")?.[String(ADMIN_PREFS_KEY)])
                    .toBe(GHOST_ON);
            },
        });
    });

    it("a stored ghost mode is restored for an admin", async () => {
        await runScenario({
            name: "ghost restored",
            rooms: [regularRoom("ghost-restore")],
            users: [namedUser("ghost-restore-user", "ghost-restore", {
                userType: UserTypeEnumMap.Admin,
                playerMetadata: { [String(ADMIN_PREFS_KEY)]: GHOST_ON },
            })],
            actions: [],
            assertions: ({ harness }) => {
                const obj = harness.getPlayerObject("ghost-restore-user");
                expect(AdminPrefsUtil.getObjectPrefs(obj!).ghostMode).toBe(true);
            },
        });
    });

    it("a stored ghost mode is dropped for a user who is no longer an admin", async () => {
        await runScenario({
            name: "ghost dropped after demotion",
            rooms: [regularRoom("ghost-demoted")],
            users: [namedUser("ghost-demoted-user", "ghost-demoted", {
                userType: UserTypeEnumMap.Member,
                playerMetadata: { [String(ADMIN_PREFS_KEY)]: GHOST_ON, "0": "still here" },
            })],
            actions: [],
            assertions: ({ harness }) => {
                const obj = harness.getPlayerObject("ghost-demoted-user");
                expect(obj!.metadata[ADMIN_PREFS_KEY]).toBeUndefined();
                // The rest of the stored metadata is restored as usual.
                expect(obj!.metadata[ObjectMetadataKeyEnumMap.SentMessage]?.str).toBe("still here");
            },
        });
    });

    // ─── Physics ───────────────────────────────────────────────────────

    it("lets a ghost and other players pass through each other, from when ghost mode goes on until it goes off",
        async () => {
        await runScenario({
            name: "ghost passing through players",
            rooms: [regularRoom("ghost-through")],
            users: [
                namedUser("ghost-through-admin", "ghost-through", {userType: UserTypeEnumMap.Admin}),
                namedUser("ghost-through-member", "ghost-through"),
            ],
            assertions: ({ users, harness }) => {
                const room = ServerRoomManager.roomRuntimeMemories["ghost-through"].room;
                const ghost = harness.getPlayerObject("ghost-through-admin")!.objectId;
                const member = harness.getPlayerObject("ghost-through-member")!.objectId;
                const setGhostMode = (value: string) => expect(ObjectUpdateUtil.setObjectMetadata(users[0].user, room,
                    new SetObjectMetadataSignal(room.id, ghost, ADMIN_PREFS_KEY, value))).toBe(true);
                // Side by side, each halfway into the other.
                standAt(room, ghost, SPOT);
                standAt(room, member, {...SPOT, x: SPOT.x + PLAYER_RADIUS_XZ});

                expect(pushOn(room, ghost)).toBeGreaterThan(0);
                expect(pushOn(room, member)).toBeGreaterThan(0);

                setGhostMode(GHOST_ON);
                expect(pushOn(room, ghost)).toBe(0);
                expect(pushOn(room, member)).toBe(0);

                setGhostMode(GHOST_OFF);
                expect(pushOn(room, ghost)).toBeGreaterThan(0);
                expect(pushOn(room, member)).toBeGreaterThan(0);
            },
        });
    });

    it("still lets a block stop a ghost, and an NPC and a fan push it", async () => {
        await runScenario({
            name: "ghost colliding with all but players",
            rooms: [roomWithWall("ghost-solid", COLUMN_ROW, COLUMN_COL)],
            users: [namedUser("ghost-solid-admin", "ghost-solid", {
                userType: UserTypeEnumMap.Admin,
                playerMetadata: { [String(ADMIN_PREFS_KEY)]: GHOST_ON },
            })],
            assertions: ({ users, harness }) => {
                const room = ServerRoomManager.roomRuntimeMemories["ghost-solid"].room;
                const admin = users[0].user;
                const ghost = harness.getPlayerObject("ghost-solid-admin")!.objectId;

                // Walked head-on into the column, it stops against it.
                const block = VoxelQueryUtil.getVoxelBlockBox(COLUMN_ROW, COLUMN_COL, 0);
                const blockFace = block.center.x - block.halfSize.x;
                let pos: Vec3 = {x: blockFace - PLAYER_RADIUS_XZ - 0.5, y: STANDING_Y, z: block.center.z};
                standAt(room, ghost, pos);
                for (let frame = 0; frame < 30; ++frame)
                    pos = step(room, ghost, pos, {x: WALKING_SPEED, y: 0, z: 0});
                expect(pos.x + PLAYER_RADIUS_XZ).toBeCloseTo(blockFace, 2);

                // Halfway into an NPC, it is pushed out.
                layOnFloor(admin, room, "npc", "Npc", {...SPOT, x: SPOT.x + PLAYER_RADIUS_XZ});
                standAt(room, ghost, SPOT);
                expect(pushOn(room, ghost)).toBeGreaterThan(0);

                // Over a fan, it is blown upward.
                layOnFloor(admin, room, "fan", "Fan", OVER_FAN);
                standAt(room, ghost, OVER_FAN);
                expect(PhysicsManager.getStepVelocity(room.id, ghost, {x: 0, y: 0, z: 0}, FRAME).underForce).toBe(true);
            },
        });
    });
});
