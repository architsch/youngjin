/**
 * Scenario tests: Signal emission correctness
 *
 * Covers:
 * - Multicast signals reach all room participants except sender
 * - Unicast rollback signals reach only the sender
 * - Desync signals reach ALL participants (including sender)
 * - No signal leaks to users in other rooms
 * - Signal batching and pending queue behavior
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
                // At least one signal should be pending for observers
                // (may have more from the initial spawn)
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

    it("failed voxel operation sends rollback unicast to sender only", async () => {
        await runScenario({
            name: "voxel rollback unicast",
            rooms: [hubRoom("rollback-hub")],
            users: usersInRoom(2, "rollback-hub"),
            actions: [
                // Add a block, then try to add again at same position (should fail)
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 },
                { type: "addVoxel", userIndex: 0, row: 10, col: 10, layer: 0 }, // duplicate
            ],
            assertions: ({ users }) => {
                // Sender should have received a rollback (removeVoxelBlockSignal)
                const u0Rollback = getPendingSignals(users[0], "removeVoxelBlockSignal");
                expect(u0Rollback.length).toBeGreaterThanOrEqual(1);
                // Other user should NOT have received the rollback
                const u1Rollback = getPendingSignals(users[1], "removeVoxelBlockSignal");
                expect(u1Rollback.length).toBe(0);
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
                // Trigger a desync by teleporting too far (>3 units)
                { type: "moveObject", userIndex: 0, x: 25, y: 0, z: 25 },
            ],
            assertions: ({ users }) => {
                // Both users (including sender) should independently have transform signals.
                // Desync broadcasts to ALL with no exclude — so each must receive at least one.
                const u0Signals = getPendingSignals(users[0], "setObjectTransformSignal");
                const u1Signals = getPendingSignals(users[1], "setObjectTransformSignal");
                expect(u0Signals.length, "sender should receive desync correction").toBeGreaterThanOrEqual(1);
                expect(u1Signals.length, "observer should receive desync correction").toBeGreaterThanOrEqual(1);
            },
        });
    });
});
