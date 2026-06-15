/**
 * Scenario tests: Single-player mode
 *
 * Covers the server-side contract for single-player rooms (e.g. the tutorial room):
 * - A single-player room is NOT loaded or stored server-side — the client generates it locally,
 *   so the server only synthesizes a transient, content-less descriptor and never registers the
 *   joining user as a participant (the player object is spawned and driven entirely client-side).
 * - The socket context is flagged as being in a single-player room.
 * - The user's lastRoomID is never persisted for a single-player room
 *   (single-player rooms are re-entered via `user.singlePlayerMode`, not lastRoomID).
 * - A multiplayer room (Hub/Regular) still registers the user as a participant.
 * - Defense-in-depth: because a single-player user is never bound to a server-side room, every
 *   room-mutating signal handler bails and no server-side room is ever created or mutated.
 *
 * Also covers shared single-player behavior:
 * - The wire format omits room content for single-player rooms (and reconstructs it empty),
 *   while multiplayer rooms still carry their full content.
 * - The shared generator builds the tutorial room's interactive blocks (the client relies on this).
 * - The tutorial step graph is name-keyed: every transition must name an existing step (or the ""
 *   terminal), and every step must be reachable from "initial".
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_HUB, userAtCenter } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerObjectManager from "../../../src/server/object/serverObjectManager";
import ServerVoxelManager from "../../../src/server/voxel/serverVoxelManager";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import RoomGenerationUtil from "../../../src/shared/room/util/roomGenerationUtil";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { voxelQuadChangeObservable } from "../../../src/shared/system/sharedObservables";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import VoxelQuadsRuntimeMemory from "../../../src/shared/voxel/types/voxelQuadsRuntimeMemory";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import Room from "../../../src/shared/room/types/room";
import RoomRuntimeMemory from "../../../src/shared/room/types/roomRuntimeMemory";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import BufferState from "../../../src/shared/networking/types/bufferState";
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

describe("single-player scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("joining a single-player room does not load a server-side room or register a participant", async () => {
        await runScenario({
            name: "join single-player room",
            rooms: [],
            users: [userAtCenter("tutorial", { singlePlayerMode: "tutorial" })],
            assertions: ({ harness, users }) => {
                // No server-side room is loaded for a single-player room — the client generates it.
                expect(harness.isRoomLoaded("tutorial")).toBe(false);
                // The user is not bound to any server-side room (the player object is client-side only).
                expect(ServerRoomManager.currentRoomIDByUserID[users[0].user.id]).toBeUndefined();
                // The socket context is flagged as single-player.
                expect(users[0].socketUserContext.isInSinglePlayerRoom).toBe(true);
            },
        });
    });

    it("does not persist lastRoomID when joining a single-player room", async () => {
        await runScenario({
            name: "single-player room does not set lastRoomID",
            rooms: [],
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

    it("rejects a single-player user's edit signals — there is no server-side room to mutate", async () => {
        await runScenario({
            name: "single-player edits never reach a server-side room",
            rooms: [],
            users: [userAtCenter("tutorial", { singlePlayerMode: "tutorial" })],
            assertions: ({ users }) => {
                const ctx = users[0].socketUserContext;
                const userID = users[0].user.id;
                const m = SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE].loadMetadata();
                const tableQuad = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(m.hotspots.table.row, m.hotspots.table.col, 1);
                const transform = new ObjectTransform({ x: 1, y: 0, z: 1 }, { x: 0, y: 0, z: 1 });

                // A single-player user is never bound to a server-side room, and none is loaded.
                expect(ServerRoomManager.currentRoomIDByUserID[userID]).toBeUndefined();
                expect(ServerRoomManager.roomRuntimeMemories["tutorial"]).toBeUndefined();

                // Fire every room-mutating signal as the single-player user. Each handler must bail
                // at its no-room guard rather than touch a room (or throw).
                ServerObjectManager.onAddObjectSignalReceived(ctx, new AddObjectSignal("tutorial", "", "", 0, "intruder", transform));
                ServerObjectManager.onRemoveObjectSignalReceived(ctx, new RemoveObjectSignal("tutorial", "npc"));
                ServerObjectManager.onSetObjectTransformSignalReceived(ctx, new SetObjectTransformSignal("tutorial", "npc", transform, false));
                ServerObjectManager.onSetObjectMetadataSignalReceived(ctx, new SetObjectMetadataSignal("tutorial", "npc", ObjectMetadataKeyEnumMap.SentMessage, "tampered"));
                ServerVoxelManager.onAddVoxelBlockSignalReceived(ctx, new AddVoxelBlockSignal("tutorial", tableQuad, [0, 0, 0, 0, 0, 0]));
                ServerVoxelManager.onRemoveVoxelBlockSignalReceived(ctx, new RemoveVoxelBlockSignal("tutorial", tableQuad));
                ServerVoxelManager.onMoveVoxelBlockSignalReceived(ctx, new MoveVoxelBlockSignal("tutorial", tableQuad, 1, 0, 0));
                ServerVoxelManager.onSetVoxelQuadTextureSignalReceived(ctx, new SetVoxelQuadTextureSignal("tutorial", tableQuad, 7));

                // Nothing changed: the user is still unbound, and no server-side room was created
                // as a side effect of any handler.
                expect(ServerRoomManager.currentRoomIDByUserID[userID]).toBeUndefined();
                expect(ServerRoomManager.roomRuntimeMemories["tutorial"]).toBeUndefined();
            },
        });
    });
});

describe("single-player room wire format", () => {
    // A single-player room is sent to the client as a content-less descriptor: Room.encode/decode
    // omit the voxel grid and object group for single-player rooms (keyed on the roomType already on
    // the wire) and reconstruct them empty, leaving the client to generate the real content locally.
    function roundTrip(mem: RoomRuntimeMemory): RoomRuntimeMemory {
        const bufferState = EncodingUtil.startEncoding();
        mem.encode(bufferState);
        const buffer = EncodingUtil.endEncoding(bufferState);
        return RoomRuntimeMemory.decode(new BufferState(new Uint8Array(buffer))) as RoomRuntimeMemory;
    }

    it("omits content for a single-player room and reconstructs it empty", () => {
        const spRoom = new Room("tutorial", "tutorial", RoomTypeEnumMap.SinglePlayer, "", "", "default",
            new VoxelGrid([], new VoxelQuadsRuntimeMemory()), new ObjectGroup([]));
        const decoded = roundTrip(new RoomRuntimeMemory(spRoom, {})).room;

        expect(decoded.roomType).toBe(RoomTypeEnumMap.SinglePlayer);
        expect(decoded.roomName).toBe("tutorial"); // identity is preserved...
        expect(decoded.voxelGrid.voxels.length).toBe(0); // ...but content is omitted on the wire.
        expect(Object.keys(decoded.objectById).length).toBe(0);
    });

    it("still round-trips full content for a multiplayer room", () => {
        const { voxelGrid, objectGroup } = RoomGenerationUtil.generateRoom("", RoomTypeEnumMap.Hub);
        const hubRoom = new Room("hub", "", RoomTypeEnumMap.Hub, "", "", "default", voxelGrid, objectGroup);
        const decoded = roundTrip(new RoomRuntimeMemory(hubRoom, {})).room;

        expect(decoded.roomType).toBe(RoomTypeEnumMap.Hub);
        expect(decoded.voxelGrid.voxels.length).toBeGreaterThan(0);
        expect(decoded.voxelGrid.voxels.length).toBe(voxelGrid.voxels.length);
    });
});

describe("single-player room generation", () => {
    // Single-player rooms are no longer built or stored server-side; the same shared generator the
    // client uses must place the tutorial's interactive blocks.
    it("generates the tutorial room with its hotspot blocks", () => {
        const { voxelGrid } = RoomGenerationUtil.generateRoom(TUTORIAL_SINGLE_PLAYER_MODE, RoomTypeEnumMap.SinglePlayer);
        const m = SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE].loadMetadata();

        // The table's top block (collision layer 1) — the quad the tutorial asks the player to
        // select and re-texture.
        const tableVoxel = VoxelQueryUtil.getVoxel(voxelGrid.voxels, m.hotspots.table.row, m.hotspots.table.col);
        expect(tableVoxel).toBeDefined();
        expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(tableVoxel!, 1)).toBe(true);

        // The obstacle block (collision layer 2) the tutorial asks the player to remove.
        const obstacleVoxel = VoxelQueryUtil.getVoxel(voxelGrid.voxels, m.hotspots.obstacle.row, m.hotspots.obstacle.col);
        expect(obstacleVoxel).toBeDefined();
        expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(obstacleVoxel!, 2)).toBe(true);
    });

    it("emits per-quad change events during generation (why the client listens only after voxels spawn)", () => {
        // Generation builds walls through the runtime-edit path, which emits a voxelQuadChangeObservable
        // event per quad. The client therefore registers its quad-change listener only once the room's
        // voxel game objects exist — ClientVoxelManager.load() runs after ClientObjectManager.load() in
        // app.ts, and unload() runs before those objects are despawned. Otherwise these generation-time
        // events would look up voxels that haven't spawned ("Voxel not found"). This guards that
        // generation is in fact a source of such events.
        let fireCount = 0;
        voxelQuadChangeObservable.addListener("test-spy", () => { fireCount++; });
        try
        {
            RoomGenerationUtil.generateRoom(TUTORIAL_SINGLE_PLAYER_MODE, RoomTypeEnumMap.SinglePlayer);
            expect(fireCount).toBeGreaterThan(0);
        }
        finally
        {
            voxelQuadChangeObservable.removeListener("test-spy");
        }
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
