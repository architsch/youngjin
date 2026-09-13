/**
 * Scenario tests: single-player mode (see @docs/networking/single_player_mode.md).
 * Server: the room is never loaded or stored (a transient, content-less descriptor), the user isn't a
 * participant, the context is flagged, lastRoomID isn't persisted, and every room-mutating handler bails.
 * Shared: the wire format omits content, the generator builds the tutorial room, and the tutorial step
 * graph is well-formed.
 */
import { describe, it, expect, beforeEach, vi, Mock } from "vitest";

// Tutorial steps reach for the room, character and camera; stubbed so tests can place them freely.
vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const camera = new THREE.PerspectiveCamera();
    // Voxel edits invalidate the light map (see LightBlockMap); a stub suffices.
    const lightBlockMap = { requestRecomputation() {}, resetForRoom(_voxels?: unknown) {},
        getNearbyLightAt(_worldPos: unknown, out: any) { return out.setRGB(0, 0, 0); } };
    return { default: { getCamera: () => camera, getScene: () => new THREE.Scene(),
        getLightBlockMap: () => lightBlockMap,
        setViewDistance: () => {}, setPointLightSurroundings: () => {},
        setRoomLightingPrefs: () => {} } };
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

// The mode's shared variables (the real manager clears them when the mode ends).
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
import DoorObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { DoorTypeEnumMap } from "../../../src/shared/object/types/doorType";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
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
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, HUB_ROOM_ID_KEYWORD,
    NUM_VOXEL_COLS, NUM_VOXEL_ROWS, STOREY_FLOOR_COLLISION_LAYER,
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
                // lastRoomID stays empty (re-entry uses user.singlePlayerMode).
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
                // A real dividing-wall quad, so a misbehaving handler would have something to touch.
                const wallQuad = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(
                    m.volumes.wall1.rowMin, m.volumes.wall1.colMin, COLLISION_LAYER_MIN);
                const transform = new ObjectTransform({ x: 1, y: 0, z: 1 }, { x: 0, y: 0, z: 1 });

                // A single-player user is never bound to a server-side room, and none is loaded.
                expect(ServerRoomManager.currentRoomIDByUserID[userID]).toBeUndefined();
                expect(ServerRoomManager.roomRuntimeMemories["tutorial"]).toBeUndefined();

                // Each room-mutating handler must bail at its no-room guard (without throwing).
                ServerObjectManager.onAddObjectSignalReceived(ctx, new AddObjectSignal("tutorial", "", "", 0, "intruder", transform));
                ServerObjectManager.onRemoveObjectSignalReceived(ctx, new RemoveObjectSignal("tutorial", "npc"));
                ServerObjectManager.onSetObjectTransformSignalReceived(ctx, new SetObjectTransformSignal("tutorial", "npc", transform, false));
                ServerObjectManager.onSetObjectMetadataSignalReceived(ctx, new SetObjectMetadataSignal("tutorial", "npc", ObjectMetadataKeyEnumMap.SentMessage, "tampered"));
                ServerVoxelManager.onAddVoxelBlockSignalReceived(ctx, new AddVoxelBlockSignal("tutorial", wallQuad, [0, 0, 0, 0, 0, 0]));
                ServerVoxelManager.onRemoveVoxelBlockSignalReceived(ctx, new RemoveVoxelBlockSignal("tutorial", wallQuad));
                ServerVoxelManager.onMoveVoxelBlockSignalReceived(ctx, new MoveVoxelBlockSignal("tutorial", wallQuad, 1, 0, 0));
                ServerVoxelManager.onSetVoxelQuadTextureSignalReceived(ctx, new SetVoxelQuadTextureSignal("tutorial", wallQuad, 7));

                // The user is still unbound, and no handler created a room.
                expect(ServerRoomManager.currentRoomIDByUserID[userID]).toBeUndefined();
                expect(ServerRoomManager.roomRuntimeMemories["tutorial"]).toBeUndefined();
            },
        });
    });
});

describe("single-player room wire format", () => {
    // Room.encode/decode omit single-player content (keyed on roomType) and reconstruct it empty.
    function roundTrip(mem: RoomRuntimeMemory): RoomRuntimeMemory {
        const bufferState = EncodingUtil.startEncoding();
        mem.encode(bufferState);
        const buffer = EncodingUtil.endEncoding(bufferState);
        return RoomRuntimeMemory.decode(new BufferState(new Uint8Array(buffer))) as RoomRuntimeMemory;
    }

    it("omits content for a single-player room and reconstructs it empty", () => {
        const spRoom = new Room("tutorial", "tutorial", RoomTypeEnumMap.SinglePlayer, "", "", "default", "",
            new VoxelGrid([], new VoxelQuadsRuntimeMemory()), new ObjectGroup([]));
        const decoded = roundTrip(new RoomRuntimeMemory(spRoom, {})).room;

        expect(decoded.roomType).toBe(RoomTypeEnumMap.SinglePlayer);
        expect(decoded.roomName).toBe("tutorial"); // identity is preserved...
        expect(decoded.voxelGrid.voxels.length).toBe(0); // ...but content is omitted on the wire.
        expect(Object.keys(decoded.objectById).length).toBe(0);
    });

    it("still round-trips full content for a multiplayer room", () => {
        const { voxelGrid, objectGroup } = RoomGenerationUtil.generateRoom("", RoomTypeEnumMap.Hub);
        const hubRoom = new Room("hub", "", RoomTypeEnumMap.Hub, "", "", "default", "", voxelGrid, objectGroup);
        const decoded = roundTrip(new RoomRuntimeMemory(hubRoom, {})).room;

        expect(decoded.roomType).toBe(RoomTypeEnumMap.Hub);
        expect(decoded.voxelGrid.voxels.length).toBeGreaterThan(0);
        expect(decoded.voxelGrid.voxels.length).toBe(voxelGrid.voxels.length);
    });
});

describe("single-player room generation", () => {
    // The shared generator (also used by the client) must build what the tutorial's steps take apart.
    it("generates the tutorial room with the walls its steps take down", () => {
        const { voxelGrid, objectGroup } = RoomGenerationUtil.generateRoom(TUTORIAL_SINGLE_PLAYER_MODE, RoomTypeEnumMap.SinglePlayer);
        const m = SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE].getRoomBuilderParams();

        // Both walls stand initially (each is removed by a later step).
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

        // The fallback floor patch (see the hotspot tests) is bare, so the requested block fits.
        const floorVoxel = VoxelQueryUtil.getVoxel(voxelGrid.voxels,
            Math.floor(m.hotspots.floor.z), Math.floor(m.hotspots.floor.x));
        expect(floorVoxel).toBeDefined();
        expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(floorVoxel!, COLLISION_LAYER_MIN)).toBe(false);

        // The two the tutorial addresses by name.
        expect(objectGroup.objectById["npc"]).toBeDefined();
        expect(objectGroup.objectById["door"]).toBeDefined();
    });

    it("dresses the tutorial's two fixtures itself, the same way every time", () => {
        // The tutorial's two fixtures have explicit appearances, which must be deterministic.
        const first = RoomGenerationUtil.generateRoom(TUTORIAL_SINGLE_PLAYER_MODE, RoomTypeEnumMap.SinglePlayer);
        const second = RoomGenerationUtil.generateRoom(TUTORIAL_SINGLE_PLAYER_MODE, RoomTypeEnumMap.SinglePlayer);

        for (const objectId of ["npc", "door"])
        {
            const appearance = first.objectGroup.objectById[objectId]
                .metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition];
            expect(appearance, `the tutorial's ${objectId} was left undressed`).toBeDefined();
            expect(appearance!.str.length).toBeGreaterThan(0);
            expect(appearance!.str).toBe(second.objectGroup.objectById[objectId]
                .metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition]!.str);
        }

        const door = first.objectGroup.objectById["door"];
        expect(DoorObjectTypeConfig.util.getLabel(door)).toBe("Door");
        expect(DoorObjectTypeConfig.util.getLabelColorIndex(door)).toBe(
            DoorObjectTypeConfig.util.getLabelColorIndex(second.objectGroup.objectById["door"]));
    });

    it("wires the tutorial's door to the hubs, as the room's own way in", () => {
        // The hubs keyword hands the player to the balancer (see DoorGameObject and RoomPickerUtil); naming
        // one hub could hit a full or deleted room, and naming nothing would lock the door.
        const { objectGroup } = RoomGenerationUtil.generateRoom(TUTORIAL_SINGLE_PLAYER_MODE, RoomTypeEnumMap.SinglePlayer);
        const door = objectGroup.objectById["door"];

        expect(DoorObjectTypeConfig.util.getDoorType(door)).toBe(DoorTypeEnumMap.DefaultEntrance);
        expect(DoorObjectTypeConfig.util.getDestinationRoomId(door)).toBe(HUB_ROOM_ID_KEYWORD);
        expect(DoorObjectTypeConfig.util.getDestinationDoorLabel(door)).toBe("");
    });

    it("builds the tutorial room as a single storey the camera can look down into", () => {
        // One storey, with its capping slab left whole.
        const { voxelGrid } = RoomGenerationUtil.generateRoom(TUTORIAL_SINGLE_PLAYER_MODE, RoomTypeEnumMap.SinglePlayer);
        const m = SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE].getRoomBuilderParams();

        // Every space the tutorial opens is on the first storey and none on the storey above.
        for (const volume of Object.values(m.volumes))
        {
            expect(volume.collisionLayerMax,
                "a tutorial space reaches past the slab that caps the room").toBeLessThan(
                STOREY_FLOOR_COLLISION_LAYER);
        }

        // The roof covers the whole grid but is never drawn, so a pulled-back camera sees into the room.
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
        // Generation emits voxelQuadChangeObservable events, so the client subscribes only once voxel game
        // objects exist (ClientVoxelManager loads after ClientObjectManager). Guards that it does emit them.
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
    // The floor patch is chosen at play time from the user's position (see "set_variable"), so it's never
    // the one hidden under the character.
    const config = SinglePlayerModeClientConfigMap[TUTORIAL_SINGLE_PLAYER_MODE];
    const room = { voxelGrid: RoomGenerationUtil.generateRoom(
        TUTORIAL_SINGLE_PLAYER_MODE, RoomTypeEnumMap.SinglePlayer).voxelGrid } as Room;

    // Each test is a fresh run (the real manager clears these when the mode ends).
    beforeEach(() => {
        for (const name of Object.keys(singlePlayerVariables))
            delete singlePlayerVariables[name];
    });

    /** Runs the step's hotspot choice with the given player and camera, storing the result as the step does. */
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

        // Bare, so the outline shows and the next step's block fits.
        const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, hotspot.row, hotspot.col);
        expect(voxel).toBeDefined();
        expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel!, COLLISION_LAYER_MIN)).toBe(false);
    });

    it("keeps the whole block-building passage on the one patch it asked for", () => {
        // The next three steps reuse the patch "select_floor" stored; this holds because that step demands
        // the pointed-at patch and the selection stays pinned.
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
        // Camera beyond the entrance wall, so the first step out of the player's cell hits wall.
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
    // Steps are addressed by name ("" ends the mode); a stale name would strand the tutorial.
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
