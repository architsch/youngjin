/**
 * Scenario tests: single-player mode (see @docs/networking/single_player_mode.md).
 * Server: the room is never loaded or stored (a transient, content-less descriptor), the user isn't a
 * participant, the context is flagged, lastRoomID isn't persisted, and every room-mutating handler bails.
 * Shared: the wire format omits content, the generator builds the tutorial room, the tutorial's edit mode
 * opens on the wall ahead and builds against a face beside it, and the tutorial step graph is well-formed.
 */
import { describe, it, expect, beforeEach, vi, Mock } from "vitest";

// Tutorial steps reach for the room and camera; stubbed so tests can place them freely.
vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const camera = new THREE.PerspectiveCamera();
    // Voxel edits invalidate the light map (see LightBlockMap); a stub suffices.
    const lightBlockMap = { requestRecomputation() {}, resetForRoom(_voxels?: unknown) {},
        getNearbyLightAt(_worldPos: unknown, out: any) { return out.setRGB(0, 0, 0); } };
    return { default: { getCamera: () => camera, getScene: () => new THREE.Scene(),
        getLightBlockMap: () => lightBlockMap,
        setViewReferenceOffset: () => {}, setPointLightSurroundings: () => {},
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
import type SinglePlayerCondition from "../../../src/client/singlePlayer/types/singlePlayerCondition";
import App from "../../../src/client/app";
import GraphicsManager from "../../../src/client/graphics/graphicsManager";
import type VoxelQuadSelection from "../../../src/client/graphics/types/gizmo/voxelQuadSelection";
import FirstPersonCameraPose from "../../../src/client/object/components/helpers/player/firstPersonCameraPose";
import { voxelQuadSelectionObservable } from "../../../src/client/system/clientObservables";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import { PLAYER_HEIGHT } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, HUB_ROOM_ID_KEYWORD,
    NUM_VOXEL_COLS, NUM_VOXEL_ROWS, STOREY_FLOOR_COLLISION_LAYER,
    TUTORIAL_SINGLE_PLAYER_MODE, UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";
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
import { FeatureFlag } from "../../../src/shared/system/types/featureFlag";

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
                const transform = new ObjectTransform({ x: 1, y: 0, z: 1 }, { x: 0, y: 0, z: 1 },
                    {...UNIT_VEC3});

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

        // The fallback floor patch (see the edit mode opening tests) is bare, so a block built on it fits.
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

describe("tutorial edit mode opening", () => {
    // Edit mode opens on the wall face ahead of the user, picked as the user switches (see
    // "edit_mode_opening_voxel_quad"), and the building steps build against that face.
    const config = SinglePlayerModeClientConfigMap[TUTORIAL_SINGLE_PLAYER_MODE];
    const m = SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE].getRoomBuilderParams();
    const room = { voxelGrid: RoomGenerationUtil.generateRoom(
        TUTORIAL_SINGLE_PLAYER_MODE, RoomTypeEnumMap.SinglePlayer).voxelGrid } as Room;

    // The eye of a user standing on the floor.
    const EYE_Y = 0.5 * PLAYER_HEIGHT + FirstPersonCameraPose.restPosition.y;

    beforeEach(() => {
        (App.getCurrentRoom as Mock).mockReturnValue(room);
        (App.getVoxelQuads as Mock).mockReturnValue(room.voxelGrid.quadsMem.quads);
        for (const name of Object.keys(singlePlayerVariables))
            delete singlePlayerVariables[name];
    });

    /** Where edit mode opens for a user whose eye is at a point, looking level toward another. */
    function openingQuadIndex(eye: {x: number, z: number}, lookToward: {x: number, z: number}): number
    {
        const camera = GraphicsManager.getCamera();
        camera.position.set(eye.x, EYE_Y, eye.z);
        camera.lookAt(lookToward.x, EYE_Y, lookToward.z);

        const opening = config.loadSteps()["start_edit"].actionsOnStart
            .find(action => action.type === "edit_mode_opening_voxel_quad");
        expect(opening, "the start_edit step no longer picks what edit mode opens on").toBeDefined();
        return (opening as Extract<SinglePlayerAction, {type: "edit_mode_opening_voxel_quad"}>).quadIndex();
    }

    /** A face's cell, layer and facing (e.g. "+z"). */
    function describeQuad(quadIndex: number): {row: number, col: number, collisionLayer: number, facing: string}
    {
        return {
            row: VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
            col: VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex),
            collisionLayer: VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex),
            facing: VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex) +
                VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex),
        };
    }

    it("opens on the drawn face of the wall straight ahead, a little below the eye", () => {
        // In the arrival room, looking down its length toward the wall at its far end.
        const col = m.entranceVoxelCol;
        const quadIndex = openingQuadIndex({x: col + 0.5, z: m.entranceVoxelRow - 2.5}, {x: col + 0.5, z: 0});
        const quad = describeQuad(quadIndex);

        expect({row: quad.row, col: quad.col, facing: quad.facing})
            .toEqual({row: m.volumes.room1.rowMin - 1, col, facing: "+z"});
        expect(room.voxelGrid.quadsMem.quads[quadIndex] & 0b10000000, "the face is not drawn").not.toBe(0);

        // About a block's height below the eye.
        const drop = EYE_Y - VoxelQueryUtil.getWorldYAtVoxelCollisionLayerCenter(quad.collisionLayer);
        expect(drop).toBeGreaterThan(0.5);
        expect(drop).toBeLessThan(1.5);
    });

    it("opens on the dividing wall when the user turns to face it", () => {
        const wall = m.volumes.wall1;
        const row = wall.rowMin + 2;
        const quad = describeQuad(openingQuadIndex({x: wall.colMin - 2.5, z: row + 0.5}, {x: NUM_VOXEL_COLS, z: row + 0.5}));

        expect({row: quad.row, col: quad.col, facing: quad.facing}).toEqual({row, col: wall.colMin, facing: "-x"});
    });

    it("follows a slanting look to where it meets the wall", () => {
        // One cell across for every cell along, from off a cell's middle so the look grazes no corner.
        const wall = m.volumes.wall1;
        const eye = {x: m.volumes.room1.colMin + 0.5, z: m.volumes.room1.rowMax - 0.8};
        const quad = describeQuad(openingQuadIndex(eye, {x: eye.x + 10, z: eye.z - 10}));

        expect({row: quad.row, col: quad.col, facing: quad.facing})
            .toEqual({row: Math.floor(eye.z - (wall.colMin - eye.x)), col: wall.colMin, facing: "-x"});
    });

    it("falls back to the room's own floor patch when no block stands ahead", () => {
        // Beyond the grid, looking away from the room.
        const x = m.entranceVoxelCol + 0.5;
        const quadIndex = openingQuadIndex({x, z: NUM_VOXEL_ROWS + 2}, {x, z: NUM_VOXEL_ROWS + 10});

        expect(quadIndex).toBe(VoxelQueryUtil.getFloorVoxelQuadIndex(
            Math.floor(m.hotspots.floor.z), Math.floor(m.hotspots.floor.x)));
    });

    // A face on the dividing wall, standing in for the one edit mode opened on.
    const wall = m.volumes.wall1;
    const openedOnRow = wall.rowMin + 2;
    const openedOnQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(openedOnRow, wall.colMin, "x", "-",
        COLLISION_LAYER_MIN + 2);

    /** Steps set aside the faces the steps after them work from (see "set_variable"). */
    const runVariables = (actions: SinglePlayerAction[]) => {
        for (const action of actions)
        {
            if (action.type === "set_variable")
                SinglePlayerManager.setVariable(action.name, action.computeValue());
        }
    };

    /** The opening face is taken from the selection the mode opened on. */
    const recordOpeningQuad = (steps: ReturnType<typeof config.loadSteps>) => {
        const peekSpy = vi.spyOn(voxelQuadSelectionObservable, "peek")
            .mockReturnValue({voxel: undefined, quadIndex: openedOnQuadIndex} as unknown as VoxelQuadSelection);
        try
        {
            runVariables(steps["start_edit"].actionsOnEnd);
        }
        finally
        {
            peekSpy.mockRestore();
        }
    };

    it("asks for a drawn face beside the one the mode opened on, builds against it, and comes back to it once the block is gone", () => {
        const steps = config.loadSteps();

        const recordOpening = steps["start_edit"].actionsOnEnd.find(action => action.type === "set_variable");
        expect(recordOpening, "the start_edit step no longer records the face the mode opened on").toBeDefined();
        recordOpeningQuad(steps);

        // The user is sent to its neighbour along the same wall, which that wall really draws.
        runVariables(steps["select_block"].actionsOnStart);
        const highlight = steps["select_block"].actionsOnStart
            .find(action => action.type === "gizmo_voxel_quad_outline_rect");
        expect(highlight, "the select_block step no longer marks the face to pick out").toBeDefined();
        const targetQuadIndex =
            (highlight as Extract<SinglePlayerAction, {type: "gizmo_voxel_quad_outline_rect"}>).quadIndex();
        expect(describeQuad(targetQuadIndex)).toEqual(
            {row: openedOnRow - 1, col: wall.colMin, collisionLayer: COLLISION_LAYER_MIN + 2, facing: "-x"});
        expect(room.voxelGrid.quadsMem.quads[targetQuadIndex] & 0b10000000, "the marked face is not drawn").not.toBe(0);

        // And nothing else in the room may be picked instead of it.
        const restriction = steps["select_block"].actionsOnStart
            .find(action => action.type === "restrict_voxel_quad_selection");
        expect(restriction, "the select_block step no longer narrows the selection to that face").toBeDefined();
        expect((restriction as Extract<SinglePlayerAction,
            {type: "restrict_voxel_quad_selection"}>).quadIndex()).toBe(targetQuadIndex);

        const selectedAtEndOf = (stepName: string): number => {
            runVariables(steps[stepName].actionsOnEnd);
            const select = steps[stepName].actionsOnEnd.find(action => action.type === "select_voxel_quad");
            expect(select, `the ${stepName} step no longer says where the selection goes`).toBeDefined();
            return (select as Extract<SinglePlayerAction, {type: "select_voxel_quad"}>).quadIndex();
        };

        // Where the block will stand is worked out before there is one, when retexturing begins.
        runVariables(steps["change_texture"].actionsOnStart);

        // The block goes into the cell that face looks into, and its own face that way is selected.
        const builtQuadIndex = selectedAtEndOf("add_block");
        expect(describeQuad(builtQuadIndex)).toEqual(
            {row: openedOnRow - 1, col: wall.colMin - 1, collisionLayer: COLLISION_LAYER_MIN + 2, facing: "-x"});

        // Which is a face the built block really draws, covering the wall's.
        const builtRoom = RoomGenerationUtil.generateRoom(TUTORIAL_SINGLE_PLAYER_MODE, RoomTypeEnumMap.SinglePlayer);
        expect(VoxelUpdateUtil.addVoxelBlock(undefined, builtRoom.voxelGrid.voxels, builtQuadIndex)).toBe(true);
        expect(builtRoom.voxelGrid.quadsMem.quads[builtQuadIndex] & 0b10000000).not.toBe(0);
        expect(builtRoom.voxelGrid.quadsMem.quads[targetQuadIndex] & 0b10000000).toBe(0);

        expect(selectedAtEndOf("remove_block")).toBe(targetQuadIndex);
    });

    it("puts the texture back on the wall face it was taken from, not on the block built against it", () => {
        // The retexturing steps straddle the building ones, and the block between them is gone by the
        // time the texture is asked back — so both must name the wall's face, never the block's.
        const steps = config.loadSteps();
        recordOpeningQuad(steps);
        runVariables(steps["select_block"].actionsOnStart);
        runVariables(steps["change_texture"].actionsOnStart);

        const targetQuadIndex = (steps["select_block"].actionsOnStart
            .find(action => action.type === "gizmo_voxel_quad_outline_rect") as
            Extract<SinglePlayerAction, {type: "gizmo_voxel_quad_outline_rect"}>).quadIndex();

        runVariables(steps["add_block"].actionsOnEnd);
        const builtQuadIndex = (steps["add_block"].actionsOnEnd
            .find(action => action.type === "select_voxel_quad") as
            Extract<SinglePlayerAction, {type: "select_voxel_quad"}>).quadIndex();
        expect(builtQuadIndex).not.toBe(targetQuadIndex);

        const requirement = steps["change_texture_back"].transitionRules[0].requirements
            .find(condition => condition.type === "voxel_quad_texture_equals");
        expect(requirement, "the change_texture_back step no longer waits on a face's texture").toBeDefined();
        const waitsOn = requirement as Extract<SinglePlayerCondition, {type: "voxel_quad_texture_equals"}>;

        expect(waitsOn.quadIndex()).toBe(targetQuadIndex);
        // And back to the texture that face wore before the user painted over it.
        expect(waitsOn.textureIndex()).toBe(room.voxelGrid.quadsMem.quads[targetQuadIndex] & 0b01111111);
    });

    it("frames the face it opened on from neither too near nor too far", () => {
        const range = config.loadSteps()["start_edit"].actionsOnEnd
            .find(action => action.type === "orbit_camera_distance_range");
        expect(range, "the start_edit step no longer keeps the camera at a sensible distance").toBeDefined();
        const {minDistance, maxDistance} = range as Extract<SinglePlayerAction, {type: "orbit_camera_distance_range"}>;

        expect(minDistance()).toBeGreaterThan(0);
        expect(maxDistance()).toBeGreaterThan(minDistance());
    });

    it("lets go of edit mode's opening once the mode is open, and however the tutorial ends", () => {
        const letsGo = (actions: SinglePlayerAction[]) =>
            actions.some(action => action.type === "clear_edit_mode_opening_voxel_quad");

        expect(letsGo(config.loadSteps()["start_edit"].actionsOnEnd)).toBe(true);
        expect(letsGo(config.onModeEnd())).toBe(true);
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

    it("opens edit mode and turns the camera, then picks a face out and retextures it before building against it, taking the block away and putting the texture back", () => {
        const steps = config.loadSteps();
        const next = (stepName: string) => steps[stepName].transitionRules[0].nextStep;

        expect([next("start_edit"), next("change_camera_angle"), next("select_block"),
            next("change_texture"), next("add_block"), next("remove_block"), next("change_texture_back")])
            .toEqual(["change_camera_angle", "select_block", "change_texture", "add_block",
                "remove_block", "change_texture_back", "exit_edit_mode"]);
    });

    it("holds the selection still from the start, and hands it back for one step only, one face wide", () => {
        // Edit mode opens on the step's own pick, and the building steps reselect, both past the lock.
        // Only the step that asks the user to select lifts it, and only onto the face it marks.
        const steps = config.loadSteps();
        const selectionLocks = [FeatureFlag.DisableVoxelQuadSelectionChange, FeatureFlag.DisableObjectSelectionChange];
        const flagsSwitched = (actions: SinglePlayerAction[], enable: boolean) => actions
            .filter((action): action is Extract<SinglePlayerAction, {type: "feature_flag"}> =>
                action.type === "feature_flag" && action.enable === enable)
            .map(action => action.flag);
        const acts = (actions: SinglePlayerAction[], type: SinglePlayerAction["type"]) =>
            actions.some(action => action.type === type);

        expect(flagsSwitched(steps["initial"].actionsOnStart, true)).toEqual(expect.arrayContaining(selectionLocks));
        for (const [name, step] of Object.entries(steps))
        {
            if (name === "select_block")
                continue;
            const lifted = [...flagsSwitched(step.actionsOnStart, false), ...flagsSwitched(step.actionsOnEnd, false)];
            expect(lifted.filter(flag => selectionLocks.includes(flag)), `step "${name}" lifts a selection lock`)
                .toEqual([]);
        }

        // The one exception, which narrows the selection as it lifts the lock and restores both after.
        const selectStep = steps["select_block"];
        expect(flagsSwitched(selectStep.actionsOnStart, false))
            .toEqual([FeatureFlag.DisableVoxelQuadSelectionChange]);
        expect(acts(selectStep.actionsOnStart, "restrict_voxel_quad_selection")).toBe(true);
        expect(flagsSwitched(selectStep.actionsOnEnd, true))
            .toEqual([FeatureFlag.DisableVoxelQuadSelectionChange]);
        expect(acts(selectStep.actionsOnEnd, "clear_voxel_quad_selection_restriction")).toBe(true);
        // However the tutorial ends, the rest of the room is selectable again.
        expect(acts(config.onModeEnd(), "clear_voxel_quad_selection_restriction")).toBe(true);
    });

    it("hides the user's own character from the start, and shows it again however the tutorial ends", () => {
        // A hidden character can't catch clicks meant for the room around it.
        const steps = config.loadSteps();
        const setsHidden = (actions: SinglePlayerAction[], hidden: boolean) =>
            actions.some(action => action.type === "set_my_player_hidden" && action.hidden === hidden);

        expect(setsHidden(steps["initial"].actionsOnStart, true)).toBe(true);
        for (const [name, step] of Object.entries(steps))
        {
            expect(setsHidden(step.actionsOnStart, false) || setsHidden(step.actionsOnEnd, false),
                `step "${name}" shows the character mid-tutorial`).toBe(false);
        }
        expect(setsHidden(config.onModeEnd(), true)).toBe(false);
        expect(setsHidden(config.onModeEnd(), false)).toBe(true);
    });
});
