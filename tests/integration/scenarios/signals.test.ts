/**
 * Scenario tests: signal emission — multicast excludes the sender, unicast rollbacks reach only the
 * sender, desyncs reach everyone, nothing leaks across rooms, and batching/pending queues.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { harness } from "../helpers/serverHarness";
import { getPendingSignals, checkMulticastSignalReach } from "../helpers/invariants";
import {
    EMPTY_REGULAR, EMPTY_HUB, hubRoom, regularRoom,
    usersInRoom, userAt, userAtCenter,
} from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerObjectManager from "../../../src/server/object/serverObjectManager";
import ServerVoxelManager from "../../../src/server/voxel/serverVoxelManager";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import AddVoxelBlockSignal from "../../../src/shared/voxel/types/update/addVoxelBlockSignal";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";

describe("signal emission scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("object transform multicast reaches all except sender", async () => {
        await runScenario({
            name: "transform multicast",
            rooms: [EMPTY_REGULAR],
            users: usersInRoom(3, "regular"),
            actions: [
                { type: "moveObject", userIndex: 0, x: 17, y: 0, z: 17 },
            ],
            assertions: ({ users }) => {
                // Users 1 and 2 should have received the transform signal
                const u1Signals = getPendingSignals(users[1], "setObjectTransformSignal");
                const u2Signals = getPendingSignals(users[2], "setObjectTransformSignal");
                // At least one pending signal for observers (the spawn may add more).
                expect(u1Signals.length).toBeGreaterThanOrEqual(1);
                expect(u2Signals.length).toBeGreaterThanOrEqual(1);
            },
        });
    });

    it("voxel add multicast reaches all except sender", async () => {
        await runScenario({
            name: "voxel add multicast",
            rooms: [hubRoom("sig-hub")],
            users: usersInRoom(3, "sig-hub"),
            actions: [
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
            ],
            assertions: ({ users }) => {
                const u1Signals = getPendingSignals(users[1], "addVoxelBlockSignal");
                const u2Signals = getPendingSignals(users[2], "addVoxelBlockSignal");
                expect(u1Signals.length).toBeGreaterThanOrEqual(1);
                expect(u2Signals.length).toBeGreaterThanOrEqual(1);
                // Sender should NOT have received the multicast
                const u0Signals = getPendingSignals(users[0], "addVoxelBlockSignal");
                expect(u0Signals.length).toBe(0);
            },
        });
    });

    it("a refused voxel operation is answered to its sender alone, with what the cell really holds", async () => {
        const LOW_X_HALF = 0b0101;
        const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(10, 10, 0);
        await runScenario({
            name: "voxel refusal unicast",
            rooms: [hubRoom("rollback-hub")],
            users: usersInRoom(2, "rollback-hub"),
            actions: [
                // A block goes up, then the same user tries to put another in its place (refused).
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0, textures: [1, 2, 3, 4, 5, 6],
                    shape: LOW_X_HALF },
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
            ],
            assertions: ({ users }) => {
                // The sender is told of the block the server holds there, which their own copy is replaced
                // by: an accepted edit is never echoed, so this is the answer to the refused one.
                const answers = getPendingSignals(users[0], "addVoxelBlockSignal");
                expect(answers.length).toBe(1);
                expect(answers[0]).toMatchObject({quadIndex, shape: LOW_X_HALF,
                    quadTextureIndicesWithinLayer: [1, 2, 3, 4, 5, 6]});
                expect(getPendingSignals(users[0], "removeVoxelBlockSignal").length).toBe(0);

                // The other user heard of the block once, and nothing of the refusal.
                expect(getPendingSignals(users[1], "addVoxelBlockSignal").length).toBe(1);
                expect(getPendingSignals(users[1], "removeVoxelBlockSignal").length).toBe(0);
            },
        });
    });

    it("a refused voxel operation on an empty cell is answered with its removal", async () => {
        const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(10, 10, 0);
        await runScenario({
            name: "voxel refusal on an empty cell",
            rooms: [hubRoom("rollback-hub")],
            users: usersInRoom(2, "rollback-hub"),
            actions: [
                // Nothing stands there to reshape, move or take away.
                { type: "reshapeVoxel", userIndex: 0, row: 10, col: 10, layer: 0, shape: 0b0101 },
                { type: "removeVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
            ],
            assertions: ({ users }) => {
                const answers = getPendingSignals(users[0], "removeVoxelBlockSignal");
                expect(answers.map(answer => answer.quadIndex)).toEqual([quadIndex, quadIndex]);
                expect(getPendingSignals(users[0], "addVoxelBlockSignal").length).toBe(0);
                for (const signalType of ["removeVoxelBlockSignal", "addVoxelBlockSignal", "setVoxelBlockShapeSignal"])
                    expect(getPendingSignals(users[1], signalType).length, signalType).toBe(0);
            },
        });
    });

    it("no signal leaks to users in other rooms", async () => {
        await runScenario({
            name: "no cross-room leaks",
            rooms: [hubRoom("room-A"), hubRoom("room-B")],
            users: [
                userAt(10, 10, "room-A"),
                userAt(20, 20, "room-B"),
            ],
            actions: [
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
            ],
            assertions: ({ users }) => {
                // User in room-B should have no voxel signals
                const u1Signals = getPendingSignals(users[1], "addVoxelBlockSignal");
                expect(u1Signals.length).toBe(0);
            },
        });
    });

    it("chat message multicast reaches room participants", async () => {
        await runScenario({
            name: "chat message multicast",
            rooms: [EMPTY_REGULAR],
            users: usersInRoom(3, "regular"),
            actions: [
                { type: "sendMessage", userIndex: 0, message: "hello everyone" },
            ],
            assertions: ({ users }) => {
                const u1Signals = getPendingSignals(users[1], "setObjectMetadataSignal");
                const u2Signals = getPendingSignals(users[2], "setObjectMetadataSignal");
                expect(u1Signals.length).toBeGreaterThanOrEqual(1);
                expect(u2Signals.length).toBeGreaterThanOrEqual(1);
            },
        });
    });

    it("desync transform signal reaches ALL participants including sender", async () => {
        await runScenario({
            name: "desync broadcast to all",
            rooms: [EMPTY_REGULAR],
            users: [
                userAt(5, 5, "regular"),
                userAt(20, 20, "regular"),
            ],
            actions: [
                // Trigger a desync by moving an object the sender has no authority over
                { type: "moveObject", userIndex: 0, targetUserIndex: 1, x: 25, y: 0, z: 25 },
            ],
            assertions: ({ users }) => {
                // Desync broadcasts to everyone, sender included.
                const u0Signals = getPendingSignals(users[0], "setObjectTransformSignal");
                const u1Signals = getPendingSignals(users[1], "setObjectTransformSignal");
                expect(u0Signals.length, "sender should receive desync correction").toBeGreaterThanOrEqual(1);
                expect(u1Signals.length, "observer should receive desync correction").toBeGreaterThanOrEqual(1);
                // The correction is server-authoritative, so it overrides client physics instead of being re-simulated.
                const correction = u0Signals[u0Signals.length - 1];
                expect(correction.ignorePhysics, "correction must be authoritative").toBe(true);
            },
        });
    });
});
