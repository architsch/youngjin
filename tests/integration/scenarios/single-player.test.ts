/**
 * Scenario tests: Single-player mode
 *
 * Covers the server-side contract for single-player rooms (e.g. the tutorial room):
 * - The room loads, but the joining user is NOT registered as a participant
 *   (the player object is spawned and driven entirely client-side).
 * - The socket context is flagged as being in a single-player room.
 * - The user's lastRoomID is never persisted for a single-player room
 *   (single-player rooms are re-entered via `user.singlePlayerMode`, not lastRoomID).
 * - A multiplayer room (Hub/Regular) still registers the user as a participant.
 * - Defense-in-depth: because a single-player user is never bound to a server-side
 *   room, every room-mutating signal handler bails and the shared room stays untouched.
 *
 * Also covers the shared tutorial config: steps are keyed by name (not positional
 * indices), so this file guards that named graph — every transition must name an
 * existing step (or the "" terminal), and every step must be reachable from "initial".
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { RoomConfig } from "../helpers/scenarioRunner";
import { EMPTY_HUB, userAtCenter } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerObjectManager from "../../../src/server/object/serverObjectManager";
import ServerVoxelManager from "../../../src/server/voxel/serverVoxelManager";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import SinglePlayerModeConfigMap from "../../../src/shared/singlePlayer/maps/singlePlayerModeConfigMap";
import { TUTORIAL_SINGLE_PLAYER_MODE } from "../../../src/shared/system/sharedConstants";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import AddVoxelBlockSignal from "../../../src/shared/voxel/types/update/addVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/removeVoxelBlockSignal";
import MoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/moveVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../../src/shared/voxel/types/update/setVoxelQuadTextureSignal";

const TUTORIAL_ROOM: RoomConfig = { id: "tutorial", type: RoomTypeEnumMap.SinglePlayer };

describe("single-player scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("joining a single-player room loads it without registering a participant", async () => {
        await runScenario({
            name: "join single-player room",
            rooms: [TUTORIAL_ROOM],
            users: [userAtCenter("tutorial", { singlePlayerMode: "tutorial" })],
            assertions: ({ harness, users }) => {
                // The room is loaded server-side...
                expect(harness.isRoomLoaded("tutorial")).toBe(true);
                // ...but the user is not a participant (the player object is client-side only).
                expect(harness.getRoomParticipantCount("tutorial")).toBe(0);
                expect(ServerRoomManager.currentRoomIDByUserID[users[0].user.id]).toBeUndefined();
                // The socket context is flagged as single-player.
                expect(users[0].socketUserContext.isInSinglePlayerRoom).toBe(true);
            },
        });
    });

    it("does not persist lastRoomID when joining a single-player room", async () => {
        await runScenario({
            name: "single-player room does not set lastRoomID",
            rooms: [TUTORIAL_ROOM],
            users: [userAtCenter("tutorial", { singlePlayerMode: "tutorial" })],
            assertions: ({ harness, users }) => {
                // lastRoomID stays empty: single-player rooms are re-entered via
                // user.singlePlayerMode, not via lastRoomID.
                expect(harness.getStoredLastRoomID(users[0].user.id) ?? "").toBe("");
            },
        });
    });

    it("joining a multiplayer room still registers the user as a participant", async () => {
        await runScenario({
            name: "multiplayer room registers participant",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: ({ harness, users }) => {
                expect(harness.getRoomParticipantCount("hub")).toBe(1);
                expect(users[0].socketUserContext.isInSinglePlayerRoom).toBe(false);
            },
        });
    });

    it("builds the tutorial room with its hotspot blocks in place", async () => {
        await runScenario({
            name: "tutorial room build",
            rooms: [TUTORIAL_ROOM],
            users: [userAtCenter("tutorial", { singlePlayerMode: "tutorial" })],
            assertions: () => {
                // The tutorial room is generated by SinglePlayerModeConfig.buildRoom when it loads.
                const roomMem = ServerRoomManager.roomRuntimeMemories["tutorial"];
                expect(roomMem).toBeDefined();
                const voxels = roomMem.room.voxelGrid.voxels;
                const m = SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE].loadMetadata();

                // The table's top block (collision layer 1) — the quad the tutorial asks
                // the player to select and re-texture.
                const tableVoxel = VoxelQueryUtil.getVoxel(voxels, m.hotspots.table.row, m.hotspots.table.col);
                expect(tableVoxel).toBeDefined();
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(tableVoxel!, 1)).toBe(true);

                // The obstacle block (collision layer 2) the tutorial asks the player to remove.
                const obstacleVoxel = VoxelQueryUtil.getVoxel(voxels, m.hotspots.obstacle.row, m.hotspots.obstacle.col);
                expect(obstacleVoxel).toBeDefined();
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(obstacleVoxel!, 2)).toBe(true);
            },
        });
    });

    it("rejects a single-player user's edit signals without mutating the shared room", async () => {
        await runScenario({
            name: "single-player edits never reach the shared room",
            rooms: [TUTORIAL_ROOM],
            users: [userAtCenter("tutorial", { singlePlayerMode: "tutorial" })],
            assertions: ({ users }) => {
                const ctx = users[0].socketUserContext;
                const userID = users[0].user.id;

                // A single-player user is never bound to a server-side room...
                expect(ServerRoomManager.currentRoomIDByUserID[userID]).toBeUndefined();

                const roomMem = ServerRoomManager.roomRuntimeMemories["tutorial"];
                const voxels = roomMem.room.voxelGrid.voxels;
                const m = SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE].loadMetadata();
                const tableQuad = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(m.hotspots.table.row, m.hotspots.table.col, 1);
                const transform = new ObjectTransform({ x: 1, y: 0, z: 1 }, { x: 0, y: 0, z: 1 });

                // The table's top block (collision layer 1) is in place before the (illegal) edits.
                const tableVoxel = VoxelQueryUtil.getVoxel(voxels, m.hotspots.table.row, m.hotspots.table.col);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(tableVoxel!, 1)).toBe(true);

                // Fire every room-mutating signal as the single-player user. Each handler must
                // bail at its no-room guard rather than touch the shared room (or throw).
                ServerObjectManager.onAddObjectSignalReceived(ctx, new AddObjectSignal("tutorial", "", "", 0, "intruder", transform));
                ServerObjectManager.onRemoveObjectSignalReceived(ctx, new RemoveObjectSignal("tutorial", "npc"));
                ServerObjectManager.onSetObjectTransformSignalReceived(ctx, new SetObjectTransformSignal("tutorial", "npc", transform, false));
                ServerObjectManager.onSetObjectMetadataSignalReceived(ctx, new SetObjectMetadataSignal("tutorial", "npc", ObjectMetadataKeyEnumMap.SentMessage, "tampered"));
                ServerVoxelManager.onAddVoxelBlockSignalReceived(ctx, new AddVoxelBlockSignal("tutorial", tableQuad, [0, 0, 0, 0, 0, 0]));
                ServerVoxelManager.onRemoveVoxelBlockSignalReceived(ctx, new RemoveVoxelBlockSignal("tutorial", tableQuad));
                ServerVoxelManager.onMoveVoxelBlockSignalReceived(ctx, new MoveVoxelBlockSignal("tutorial", tableQuad, 1, 0, 0));
                ServerVoxelManager.onSetVoxelQuadTextureSignalReceived(ctx, new SetVoxelQuadTextureSignal("tutorial", tableQuad, 7));

                // The shared room is untouched: the user still isn't registered, the table block
                // survives (remove/move rejected), and the object set neither gained an intruder
                // (add rejected) nor had its NPC removed or re-messaged (remove/metadata rejected).
                expect(ServerRoomManager.currentRoomIDByUserID[userID]).toBeUndefined();
                const tableVoxelAfter = VoxelQueryUtil.getVoxel(voxels, m.hotspots.table.row, m.hotspots.table.col);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(tableVoxelAfter!, 1)).toBe(true);
                expect(roomMem.room.objectById["npc"]).toBeDefined();
                expect(roomMem.room.objectById["intruder"]).toBeUndefined();
                expect(roomMem.room.objectById["npc"].metadata[ObjectMetadataKeyEnumMap.SentMessage]).toBeUndefined();
            },
        });
    });
});

describe("tutorial step graph", () => {
    // The tutorial's steps are addressed by name, not by array position: each transition rule
    // names the step to advance to, and "" marks the end of the mode. A mistyped or stale step
    // name would silently strand the tutorial, so these tests assert the graph is well-formed.
    const config = SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE];

    it("loadSteps returns a name-keyed map with an 'initial' entry step and a terminal step", () => {
        const steps = config.loadSteps();

        // Steps form a name-keyed map, not a positional array.
        expect(Array.isArray(steps)).toBe(false);
        // "initial" is the entry point the client jumps to when the mode starts (see app.ts).
        expect(steps["initial"]).toBeDefined();
        // At least one step is terminal: a rule whose nextStep is "" finishes the mode.
        const hasTerminal = Object.values(steps).some(
            step => step.transitionRules.some(rule => rule.nextStep === ""));
        expect(hasTerminal).toBe(true);
    });

    it("every transition targets an existing step or the terminal, and all steps are reachable from 'initial'", () => {
        const steps = config.loadSteps();

        // No rule may name a step that doesn't exist (anything but "" must be a defined key).
        for (const [name, step] of Object.entries(steps))
            for (const rule of step.transitionRules)
                if (rule.nextStep !== "")
                    expect(steps[rule.nextStep], `step "${name}" transitions to missing step "${rule.nextStep}"`).toBeDefined();

        // Walk the graph from "initial": every defined step must be reachable, so none is orphaned.
        const reachable = new Set<string>();
        const frontier = ["initial"];
        while (frontier.length > 0)
        {
            const name = frontier.pop()!;
            if (reachable.has(name))
                continue;
            reachable.add(name);
            for (const rule of steps[name].transitionRules)
                if (rule.nextStep !== "")
                    frontier.push(rule.nextStep);
        }
        expect(reachable).toEqual(new Set(Object.keys(steps)));
    });
});
