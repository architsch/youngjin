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
import { describe, it, expect, beforeEach, vi, Mock } from "vitest";

// The tutorial's steps are client-side, and reach straight for the room, the character and the
// camera as they are played. Those three are stubbed out here so that a step's own choosing can be
// run against a player and a camera placed wherever a test wants them.
vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const camera = new THREE.PerspectiveCamera();
    return { default: { getCamera: () => camera, getScene: () => new THREE.Scene() } };
});

vi.mock("../../../src/client/app", () => ({
    default: {
        getCurrentRoom: vi.fn(),
        getVoxelQuads: vi.fn(),
        getUser: vi.fn(),
    },
}));

vi.mock("../../../src/client/object/clientObjectManager", () => ({
    default: { getMyPlayer: vi.fn(), getObjectById: vi.fn() },
}));

// What the steps of a mode work out for each other while it is being played. The real manager holds
// exactly this and empties it when the mode ends; here it stands in for a run of the tutorial that
// has got as far as whatever a test says it has.
const { singlePlayerVariables } = vi.hoisted(() => ({
    singlePlayerVariables: {} as {[name: string]: any},
}));

vi.mock("../../../src/client/singlePlayer/singlePlayerManager", () => ({
    default: {
        getVariable: (name: string) => singlePlayerVariables[name],
        setVariable: (name: string, value: any) => { singlePlayerVariables[name] = value; },
    },
}));

import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_HUB, userAtCenter } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerObjectManager from "../../../src/server/object/serverObjectManager";
import ServerVoxelManager from "../../../src/server/voxel/serverVoxelManager";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import RoomGenerationUtil from "../../../src/shared/room/generation/util/roomGenerationUtil";
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
import SinglePlayerModeClientConfigMap from "../../../src/client/singlePlayer/maps/singlePlayerModeClientConfigMap";
import SinglePlayerManager from "../../../src/client/singlePlayer/singlePlayerManager";
import SinglePlayerAction from "../../../src/client/singlePlayer/types/singlePlayerAction";
import SinglePlayerCondition from "../../../src/client/singlePlayer/types/singlePlayerCondition";
import App from "../../../src/client/app";
import GraphicsManager from "../../../src/client/graphics/graphicsManager";
import ClientObjectManager from "../../../src/client/object/clientObjectManager";
import Vec3 from "../../../src/shared/math/types/vec3";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS, STOREY_FLOOR_COLLISION_LAYER,
    TUTORIAL_SINGLE_PLAYER_MODE } from "../../../src/shared/system/sharedConstants";
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
                const m = SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE].getRoomBuilderParams();
                // A quad of the dividing wall — a real part of the tutorial room, so that a handler
                // that did touch a room would have something to touch.
                const wallQuad = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(
                    m.volumes.wall1.rowMin, m.volumes.wall1.colMin, COLLISION_LAYER_MIN);
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
                ServerVoxelManager.onAddVoxelBlockSignalReceived(ctx, new AddVoxelBlockSignal("tutorial", wallQuad, [0, 0, 0, 0, 0, 0]));
                ServerVoxelManager.onRemoveVoxelBlockSignalReceived(ctx, new RemoveVoxelBlockSignal("tutorial", wallQuad));
                ServerVoxelManager.onMoveVoxelBlockSignalReceived(ctx, new MoveVoxelBlockSignal("tutorial", wallQuad, 1, 0, 0));
                ServerVoxelManager.onSetVoxelQuadTextureSignalReceived(ctx, new SetVoxelQuadTextureSignal("tutorial", wallQuad, 7));

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
    // client uses must build what the tutorial's steps then work on and take apart.
    it("generates the tutorial room with the walls its steps take down", () => {
        const { voxelGrid, objectGroup } = RoomGenerationUtil.generateRoom(TUTORIAL_SINGLE_PLAYER_MODE, RoomTypeEnumMap.SinglePlayer);
        const m = SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE].getRoomBuilderParams();

        // Both walls stand to begin with: the one between the user and the receptionist, which the
        // step that sends him there takes down, and the one across the way out, which the last step
        // takes down. A wall already gone is a step with nothing to open.
        for (const volume of [m.volumes.wall1, m.volumes.wall2])
        {
            for (let row = volume.rowMin; row <= volume.rowMax; ++row)
            {
                for (let col = volume.colMin; col <= volume.colMax; ++col)
                {
                    const voxel = VoxelQueryUtil.getVoxel(voxelGrid.voxels, row, col);
                    expect(voxel).toBeDefined();
                    expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel!, COLLISION_LAYER_MIN)).toBe(true);
                }
            }
        }

        // The patch of floor the tutorial falls back on when it can find none of its own (see the
        // hotspot tests below): bare, so that the block the user is told to add has somewhere to go.
        const floorVoxel = VoxelQueryUtil.getVoxel(voxelGrid.voxels,
            Math.floor(m.hotspots.floor.z), Math.floor(m.hotspots.floor.x));
        expect(floorVoxel).toBeDefined();
        expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(floorVoxel!, COLLISION_LAYER_MIN)).toBe(false);

        // The two the tutorial addresses by name.
        expect(objectGroup.objectById["npc"]).toBeDefined();
        expect(objectGroup.objectById["door"]).toBeDefined();
    });

    it("builds the tutorial room as a single storey the camera can look down into", () => {
        // The tutorial is played from above as much as from inside it, so the room is built as one
        // storey with the slab that caps it left whole: the space the player is walked around in
        // stops there, and everything over it is the mass the room was carved out of.
        const { voxelGrid } = RoomGenerationUtil.generateRoom(TUTORIAL_SINGLE_PLAYER_MODE, RoomTypeEnumMap.SinglePlayer);
        const m = SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE].getRoomBuilderParams();

        // Every space the tutorial opens is on the first storey and none on the storey above.
        for (const volume of Object.values(m.volumes))
        {
            expect(volume.collisionLayerMax,
                "a tutorial space reaches past the slab that caps the room").toBeLessThan(
                STOREY_FLOOR_COLLISION_LAYER);
        }

        // The roof: laid over the whole grid, and drawn nowhere on it. That it is never drawn is
        // what lets a camera drawn back far enough look into the room rather than down onto a lid —
        // and it is asked of every cell rather than of the room's own spaces, because the mass the
        // room is set into stands at that height too, and a lid over that reads from above exactly
        // like a lid over the room.
        for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
        {
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            {
                const voxel = VoxelQueryUtil.getVoxel(voxelGrid.voxels, row, col)!;
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, STOREY_FLOOR_COLLISION_LAYER),
                    `(${row},${col}) has nothing over it`).toBe(true);

                for (let layer = STOREY_FLOOR_COLLISION_LAYER; layer <= COLLISION_LAYER_MAX; ++layer)
                {
                    const topQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(row, col, "y", "+", layer);
                    expect(voxelGrid.quadsMem.quads[topQuadIndex] & 0b10000000,
                        `(${row},${col}) draws a lid over the room at layer ${layer}`).toBe(0);
                }
            }
        }
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

describe("tutorial floor hotspot", () => {
    // The patch of floor the tutorial asks the user to select is settled while the step is being
    // played, from where the user happens to be standing (see the "set_variable" action): a patch
    // fixed in the room's layout would sooner or later be the one he is standing on, where the
    // outline drawn around it and the arrow hanging over it would be lost inside his own character.
    const config = SinglePlayerModeClientConfigMap[TUTORIAL_SINGLE_PLAYER_MODE];
    const room = { voxelGrid: RoomGenerationUtil.generateRoom(
        TUTORIAL_SINGLE_PLAYER_MODE, RoomTypeEnumMap.SinglePlayer).voxelGrid } as Room;

    // Each test is its own run of the tutorial, and nothing an earlier one worked out carries over
    // — which is what the real manager guarantees by emptying these when the mode ends.
    beforeEach(() => {
        for (const name of Object.keys(singlePlayerVariables))
            delete singlePlayerVariables[name];
    });

    /**
     * Plays the step's own choosing, with the user and the camera placed where the test wants them,
     * and sets the result aside under its own name exactly as the step does — which is what leaves
     * everything the step points with something to read back.
     */
    function pickHotspot(playerPosition: Vec3, cameraPosition: Vec3): {row: number, col: number} {
        (App.getCurrentRoom as Mock).mockReturnValue(room);
        (ClientObjectManager.getMyPlayer as Mock).mockReturnValue({ position: playerPosition });
        GraphicsManager.getCamera().position.set(
            cameraPosition.x, cameraPosition.y, cameraPosition.z);

        const setVariable = config.loadSteps()["before_select_floor"].actionsOnStart
            .find(action => action.type === "set_variable");
        expect(setVariable, "the before_select_floor step no longer settles anything").toBeDefined();
        const action = setVariable as Extract<SinglePlayerAction, {type: "set_variable"}>;
        SinglePlayerManager.setVariable(action.name, action.computeValue());
        return SinglePlayerManager.getVariable(action.name);
    }

    it("picks a bare patch of floor between the player and the camera", () => {
        // Standing inside the entrance region, with the camera pulled back the way the room runs.
        const hotspot = pickHotspot({ x: 4.5, y: 0, z: 28.5 }, { x: 4.5, y: 3, z: 18.5 });

        // Toward the camera, and never the patch the user is standing on.
        expect(hotspot.col).toBe(4);
        expect(hotspot.row).toBeLessThan(28);

        // Bare, so the outline drawn around it is visible and the block the user is asked to build
        // on it afterwards has somewhere to go.
        const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, hotspot.row, hotspot.col);
        expect(voxel).toBeDefined();
        expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel!, COLLISION_LAYER_MIN)).toBe(false);
    });

    it("keeps the whole block-building passage on the one patch it asked for", () => {
        // The three steps after "select_floor" all work on that patch: its texture, the block built
        // on it, and the floor uncovered when that block goes again. That only holds because the
        // step demands the patch it is pointing at rather than taking whichever quad the user
        // clicked, and because each step afterwards says outright where the selection goes — the
        // selection being pinned throughout, so the user cannot carry it off mid-passage. Each of
        // them reads the one patch back out of what "select_floor" settled, which is what makes the
        // passage hold together wherever the user happened to be standing when it began.
        const hotspot = pickHotspot({ x: 4.5, y: 0, z: 28.5 }, { x: 4.5, y: 3, z: 18.5 });
        const steps = config.loadSteps();

        const wanted = steps["select_floor"].transitionRules[0].requirements[0];
        expect(wanted.type).toBe("voxel_quad_selected");
        const quad = wanted as Extract<SinglePlayerCondition, {type: "voxel_quad_selected"}>;
        expect({row: quad.row!(), col: quad.col!()}).toEqual(hotspot);
        expect(quad.collisionLayer!()).toBe(COLLISION_LAYER_NULL);
        expect([quad.facingAxis, quad.orientation]).toEqual(["y", "+"]);

        // Up onto the block just built, then back down onto the floor it stood on.
        const landsOn = (stepName: string) => {
            const select = steps[stepName].actionsOnEnd
                .find(action => action.type === "select_voxel_quad");
            expect(select, `the ${stepName} step no longer says where the selection goes`).toBeDefined();
            const at = select as Extract<SinglePlayerAction, {type: "select_voxel_quad"}>;
            return {row: at.row(), col: at.col(), collisionLayer: at.collisionLayer()};
        };
        expect(landsOn("add_block")).toEqual({...hotspot, collisionLayer: COLLISION_LAYER_MIN});
        expect(landsOn("remove_block")).toEqual({...hotspot, collisionLayer: COLLISION_LAYER_NULL});

        // And the camera is turned on that same patch before the user is asked to look for it.
        const override = steps["before_select_floor"].actionsOnStart
            .find(action => action.type === "orbit_camera_target_override");
        expect(override, "the before_select_floor step no longer shows the user the patch").toBeDefined();
        const at = override as Extract<SinglePlayerAction, {type: "orbit_camera_target_override"}>;
        expect([at.targetX(), at.targetZ()]).toEqual([hotspot.col + 0.5, hotspot.row + 0.5]);
    });

    it("falls back to the room's own patch when the floor gives out at once", () => {
        // Camera on the far side of the entrance wall, so the first step out of the player's cell
        // lands in solid wall.
        const m = SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE].getRoomBuilderParams();
        const hotspot = pickHotspot(
            { x: m.entranceVoxelCol + 0.5, y: 0, z: m.entranceVoxelRow + 0.5 },
            { x: m.entranceVoxelCol + 0.5, y: 3, z: m.entranceVoxelRow + 10.5 });

        // The room's own patch is declared as a world position; the step works in cells.
        expect(hotspot).toEqual(
            { row: Math.floor(m.hotspots.floor.z), col: Math.floor(m.hotspots.floor.x) });
    });
});

describe("tutorial step graph", () => {
    // The tutorial's steps are addressed by name, not by array position: each transition rule
    // names the step to advance to, and "" marks the end of the mode. A mistyped or stale step
    // name would silently strand the tutorial, so these tests assert the graph is well-formed.
    const config = SinglePlayerModeClientConfigMap[TUTORIAL_SINGLE_PLAYER_MODE];

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
