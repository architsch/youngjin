/**
 * Scenario tests: object management — spawning, transform updates, authority checks (which trigger a
 * resync), removal on leave, physics-only movement bounds, player metadata snapshots, chat metadata.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_REGULAR, userAt, usersInRoom, walkAcross, disconnectWithSave } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerObjectManager from "../../../src/server/object/serverObjectManager";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import SpawnHotspotUtil from "../../../src/server/room/util/spawnHotspotUtil";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import { PLAYER_HEIGHT } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import { INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
    UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import CanvasObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import Vec3 from "../../../src/shared/math/types/vec3";

// Players spawn behind the fixture room's only door; asked of the room (SpawnHotspotUtil is tested on its own).
function spawnPos(roomID: string): {x: number, z: number}
{
    const room = ServerRoomManager.roomRuntimeMemories[roomID].room;
    const {pos} = SpawnHotspotUtil.pickSpawnTransform(room, "");
    return {x: pos.x, z: pos.z};
}

const PLAYER_OBJECT_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Player");

const SPAWN_X = INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL + 0.5;

// A standable point just inside the entrance, written out since actions are declared before the room exists.
const SPAWN_Z = INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW - 0.5;

describe("object scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("two players both spawn at the room entrance", async () => {
        await runScenario({
            name: "spawn positions",
            rooms: [EMPTY_REGULAR],
            users: [
                userAt(10, 10, "regular"),
                userAt(20, 20, "regular"),
            ],
            assertions: ({ users, harness }) => {
                const obj1 = harness.getPlayerObject(users[0].user.id);
                const obj2 = harness.getPlayerObject(users[1].user.id);
                expect(obj1).toBeDefined();
                expect(obj2).toBeDefined();
                expect(obj1!.transform.pos.x).toBeCloseTo(SPAWN_X);
                expect(obj1!.transform.pos.z).toBeCloseTo(spawnPos("regular").z);
                expect(obj2!.transform.pos.x).toBeCloseTo(SPAWN_X);
                expect(obj2!.transform.pos.z).toBeCloseTo(spawnPos("regular").z);
            },
        });
    });

    it("player can update own object transform", async () => {
        await runScenario({
            name: "update own transform",
            rooms: [EMPTY_REGULAR],
            users: [userAt(10, 10, "regular")],
            actions: [{ type: "moveObject", userIndex: 0, x: SPAWN_X, y: 0.5 * PLAYER_HEIGHT, z: SPAWN_Z - 2 }],
            assertions: ({ users, harness }) => {
                const obj = harness.getPlayerObject(users[0].user.id);
                expect(obj).toBeDefined();
                // Open floor, so the server accepts a position near the target.
                expect(obj!.transform.pos.x).toBeCloseTo(SPAWN_X, 0);
                expect(obj!.transform.pos.z).toBeCloseTo(SPAWN_Z - 2, 0);
            },
        });
    });

    it("player cannot move another player's object", async () => {
        await runScenario({
            name: "authority check",
            rooms: [EMPTY_REGULAR],
            users: [
                userAt(10, 10, "regular"),
                userAt(20, 20, "regular"),
            ],
            actions: [],
            assertions: ({ users, harness }) => {
                const u2Obj = harness.getPlayerObject(users[1].user.id)!;
                const roomID = ServerRoomManager.currentRoomIDByUserID[users[0].user.id];

                // Try to move user2's object as user1
                const signal = new SetObjectTransformSignal(
                    roomID, u2Obj.objectId,
                    new ObjectTransform({x: 15, y: 0, z: 15}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3}),
                    false,
                );
                ServerObjectManager.onSetObjectTransformSignalReceived(users[0].socketUserContext, signal);

                // user2's position should be unchanged (still at the entrance)
                const obj2 = harness.getPlayerObject(users[1].user.id)!;
                expect(obj2.transform.pos.x).toBeCloseTo(SPAWN_X);
                expect(obj2.transform.pos.z).toBeCloseTo(spawnPos("regular").z);
            },
        });
    });

    it("holds a canvas to the sizes its type allows, whatever size is asked for", async () => {
        await runScenario({
            name: "hostile canvas scale",
            rooms: [EMPTY_REGULAR],
            users: [userAt(10, 10, "regular")],
            assertions: ({ users }) => {
                const user = users[0].user;
                const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
                const room = ServerRoomManager.roomRuntimeMemories[roomID].room;
                const scaling = CanvasObjectTypeConfig.scaling;

                // On the boundary wall, where a canvas has something to hang from.
                const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
                const canvas = new AddObjectSignal(roomID, user.id, user.userName,
                    canvasTypeIndex, "sized-canvas",
                    new ObjectTransform({x: 16.5, y: 1.5, z: 1}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3}), {});
                expect(ObjectUpdateUtil.addObject(user, room, canvas)).toBe(true);

                const askFor = (scale: Vec3) => {
                    ServerObjectManager.onSetObjectTransformSignalReceived(users[0].socketUserContext,
                        new SetObjectTransformSignal(roomID, "sized-canvas",
                            new ObjectTransform({x: 16.5, y: 1.5, z: 1}, {x: 0, y: 0, z: 1}, scale), true));
                    return room.objectById["sized-canvas"].transform.scale;
                };

                // Far past the limit, below it, and off the step grid.
                expect(askFor({x: 999, y: 999, z: 999}).x).toBe(scaling.maxScale.x);
                expect(askFor({x: 0.01, y: 0.01, z: 0.01}).x).toBe(scaling.minScale.x);
                expect(askFor({x: 1.7, y: 1.7, z: 1}).x).toBe(1.5);
                // Depth is the wall gap, and no request opens it up.
                expect(askFor({x: 2, y: 2, z: 9}).z).toBe(1);
            },
        });
    });

    it("keeps a player's own size at its type's, since a player declares no scaling", async () => {
        await runScenario({
            name: "player scale is not a client's to set",
            rooms: [EMPTY_REGULAR],
            users: [userAt(10, 10, "regular")],
            assertions: ({ users, harness }) => {
                const obj = harness.getPlayerObject(users[0].user.id)!;
                const roomID = ServerRoomManager.currentRoomIDByUserID[users[0].user.id];

                ServerObjectManager.onSetObjectTransformSignalReceived(users[0].socketUserContext,
                    new SetObjectTransformSignal(roomID, obj.objectId,
                        new ObjectTransform({x: SPAWN_X, y: 0.5 * PLAYER_HEIGHT, z: SPAWN_Z},
                            {x: 0, y: 0, z: 1}, {x: 6, y: 6, z: 6}), false));

                expect(obj.transform.scale).toEqual(UNIT_VEC3);
            },
        });
    });

    it("objects are removed when user leaves room", async () => {
        await runScenario({
            name: "objects removed on leave",
            rooms: [EMPTY_REGULAR],
            users: [
                userAt(10, 10, "regular"),
                userAt(20, 20, "regular"),
            ],
            assertions: ({ users, harness }) => {
                // The door stays, so only players are counted.
                const roomMem = ServerRoomManager.roomRuntimeMemories["regular"];
                const playerObjects = Object.values(roomMem.room.objectById)
                    .filter(obj => obj.objectTypeIndex === PLAYER_OBJECT_TYPE_INDEX);
                expect(playerObjects).toHaveLength(2);
            },
        });
    });

    it("a far position jump is accepted rather than force-resynced", async () => {
        await runScenario({
            name: "no distance-based desync",
            rooms: [EMPTY_REGULAR],
            users: [userAt(5, 5, "regular")],
            actions: [
                // Distance alone must not revert a move (latency makes long jumps routine).
                { type: "moveObject", userIndex: 0, x: SPAWN_X, y: 0, z: SPAWN_Z - 20 },
            ],
            assertions: ({ users, harness }) => {
                const obj = harness.getPlayerObject(users[0].user.id)!;
                // Only collisions constrain movement, and the path is clear.
                expect(obj.transform.pos.x).toBeCloseTo(SPAWN_X, 0);
                expect(obj.transform.pos.z).toBeCloseTo(SPAWN_Z - 20, 0);
            },
        });
    });

    it("ServerUserManager.getPlayerMetadata mirrors live player-object metadata", async () => {
        await runScenario({
            name: "metadata snapshot mirrors player object",
            rooms: [EMPTY_REGULAR],
            users: [userAt(11, 22, "regular")],
            actions: [
                ...walkAcross(0, 2),
                { type: "sendMessage", userIndex: 0, message: "snapshot" },
            ],
            assertions: ({ users, harness }) => {
                const obj = harness.getPlayerObject(users[0].user.id)!;
                const metadata = harness.getPlayerMetadata(users[0].user.id)!;
                expect(metadata["0"]).toBe(obj.metadata[0]?.str);
                expect(metadata["0"]).toBe("snapshot");
            },
        });
    });

    it("disconnect-with-save persists lastRoomID and flushes the latest metadata", async () => {
        await runScenario({
            name: "disconnect persists lastRoomID",
            rooms: [EMPTY_REGULAR],
            users: [userAt(16, 16, "regular", { id: "post-walk-user" })],
            actions: [
                ...walkAcross(0, 3),
                { type: "sendMessage", userIndex: 0, message: "post-walk" },
                disconnectWithSave(0),
            ],
            skipInvariants: true,
            assertions: ({ harness }) => {
                expect(harness.getStoredLastRoomID("post-walk-user")).toBe("regular");
                const saved = harness.savedPlayerMetadataRecords[0];
                expect(saved).toBeDefined();
                expect(saved.playerMetadata["0"]).toBe("post-walk");
            },
            skipCleanup: true,
        });
    });

    it("chat messages are stored in player metadata", async () => {
        await runScenario({
            name: "chat message metadata",
            rooms: [EMPTY_REGULAR],
            users: [userAt(16, 16, "regular")],
            actions: [{ type: "sendMessage", userIndex: 0, message: "hello world" }],
            assertions: ({ users, harness }) => {
                const obj = harness.getPlayerObject(users[0].user.id)!;
                expect(obj.metadata[0]?.str).toBe("hello world");
            },
        });
    });
});
