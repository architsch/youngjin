/**
 * Scenario tests: voxelQuad auto-reselection. When a selection is interrupted (the user's own edit,
 * another client's edit, or the selected object going away), or is to move on from an object, a nearby visible
 * quad is selected instead: the nearest that is near and clear enough of objects, else an object near there.
 * Browser-bound client modules are stubbed; generation, update rules and the search run for real.
 */
import { describe, it, expect, beforeEach, afterEach, vi, Mock, MockInstance } from "vitest";

vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const camera = new THREE.PerspectiveCamera();
    const scene = new THREE.Scene();
    // Voxel edits invalidate the light map (see LightBlockMap); a stub suffices.
    const lightBlockMap = { requestRecomputation() {}, resetForRoom(_voxels?: unknown) {},
        getNearbyLightAt(_worldPos: unknown, out: any) { return out.setRGB(0, 0, 0); } };
    return { default: { getCamera: () => camera, getScene: () => scene,
        getLightBlockMap: () => lightBlockMap,
        setViewReferenceOffset: () => {}, setPointLightSurroundings: () => {},
        setRoomLightingPrefs: () => {} } };
});

vi.mock("../../../src/client/app", () => ({
    default: {
        getCurrentRoom: vi.fn(),
        getVoxelQuads: vi.fn(),
        getUser: vi.fn(),
        getEnv: vi.fn(),
    },
}));

vi.mock("../../../src/client/graphics/types/gizmo/generic/worldSpaceOutlineRect", () => ({
    default: class WorldSpaceOutlineRectStub
    {
        static async create() { return new WorldSpaceOutlineRectStub(); }
        addToParent() {}
        setTransform() {}
        setTransformRaw() {}
        setVisible() {}
        dispose() {}
    },
}));

import * as THREE from "three";
import App from "../../../src/client/app";
import GraphicsManager from "../../../src/client/graphics/graphicsManager";
import GameObject from "../../../src/client/object/types/gameObject/gameObject";
import ObjectSelection from "../../../src/client/graphics/types/gizmo/objectSelection";
import VoxelQuadSelection from "../../../src/client/graphics/types/gizmo/voxelQuadSelection";
import ClientVoxelManager from "../../../src/client/voxel/clientVoxelManager";
import ClientObjectManager from "../../../src/client/object/clientObjectManager";
import { clientFeatureFlagsObservable, gameModeObservable, objectSelectionObservable, roomChangedObservable,
    voxelQuadSelectionObservable,
    voxelQuadSelectionRestrictionObservable } from "../../../src/client/system/clientObservables";
import WorldSpaceSelectionUtil from "../../../src/client/graphics/util/worldSpaceSelectionUtil";
import { FeatureFlag } from "../../../src/shared/system/types/featureFlag";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_ROOM_X, MAX_ROOM_Z, NUM_VOXEL_COLS, NUM_VOXEL_ROWS,
    NUM_VOXEL_QUADS_PER_COLLISION_LAYER, GENERATED_WALL_THICKNESS,
    VOXEL_CELL_SIZE } from "../../../src/shared/system/sharedConstants";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import AddVoxelBlockSignal from "../../../src/shared/voxel/types/update/addVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/removeVoxelBlockSignal";
import MoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/moveVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../../src/shared/voxel/types/update/setVoxelQuadTextureSignal";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import ObjectAttachmentUtil from "../../../src/shared/object/util/objectAttachmentUtil";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import Vec3 from "../../../src/shared/math/types/vec3";
import Room from "../../../src/shared/room/types/room";
import RoomRuntimeMemory from "../../../src/shared/room/types/roomRuntimeMemory";
import { createEditingUser } from "../helpers/mockUser";
import {
    buildPillar, ceilingQuadIndexOf, createRoom, currentSelection, floorQuadIndexOf, forceSelect,
    isQuadVisible, quadIndexOf, SelectionSnapshot, userAddsBlockAt, userRemovesBlockAt, voxelAt,
} from "../helpers/selectionHarness";

// The acting user (editing utilities require one).
const actingUser = createEditingUser();

const ROOM_ID = "reselection-room";
const WALL_TEXTURES = [1, 1, 1, 1, 1, 1];
const WALL_FACES: ["x" | "z", "-" | "+"][] = [["x", "-"], ["x", "+"], ["z", "-"], ["z", "+"]];

// How many voxels thick the room's own wall is: the innermost of them show their faces to the room, and the
// open floor begins a voxel further in.
const WALL_THICKNESS = GENERATED_WALL_THICKNESS;

const VOXELS_PER_WORLD_UNIT = 1 / VOXEL_CELL_SIZE;

// How many voxels to either side an automatic selection looks: a world unit (see
// VoxelQuadSelection.trySelectBestQuad).
const SEARCH_REACH = Math.round(1 / VOXEL_CELL_SIZE);

let room: Room;

function useRoom(newRoom: Room)
{
    room = newRoom;
    (App.getCurrentRoom as Mock).mockReturnValue(room);
    (App.getVoxelQuads as Mock).mockReturnValue(room.voxelQuads);
}

/** Puts the camera somewhere inside the room, since the search uses it as a tiebreak. */
function placeCameraAt(x: number, y: number, z: number)
{
    GraphicsManager.getCamera().position.set(x, y, z);
    GraphicsManager.getCamera().updateMatrixWorld(true);
}

/** The middle of a face, drawn or not. */
function middleOf(quadIndex: number): Vec3
{
    const dims = VoxelQueryUtil.getVoxelQuadTransformDimensions(room.voxelGrid.voxels, quadIndex, true);
    return {
        x: VoxelQueryUtil.getWorldXAtVoxelColCenter(VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex)) + dims.offsetX,
        y: dims.offsetY,
        z: VoxelQueryUtil.getWorldZAtVoxelRowCenter(VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex)) + dims.offsetZ,
    };
}

/** The same face of the block right behind a face's own, or -1 where that lies outside the grid. */
function faceBehind(quadIndex: number): number
{
    const axis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
    const back = (orientation == "+") ? -1 : 1;
    return quadIndexOf(VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex) + ((axis == "z") ? back : 0),
        VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex) + ((axis == "x") ? back : 0), axis, orientation,
        VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex));
}

/** The cell layer a quad belongs to, as its block index. */
function blockIndexOf(quadIndex: number): number
{
    return VoxelQueryUtil.getVoxelBlockIndex(VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
        VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex),
        VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex));
}

/** Asserts that the interruption left the user with a quad they can actually see. */
function expectSomethingVisibleIsSelected()
{
    const after = currentSelection(room);
    expect(after).not.toBeNull();
    expect(after!.visible).toBe(true);
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    clientFeatureFlagsObservable.tryRemove(FeatureFlag.DisableVoxelQuadSelectionChange);
    clientFeatureFlagsObservable.tryRemove(FeatureFlag.DisableAllSelectionChange);
    voxelQuadSelectionRestrictionObservable.set(null);
    // Selections exist only in edit mode (see GameModeUtil).
    gameModeObservable.set("edit");
    voxelQuadSelectionObservable.set(null);
    objectSelectionObservable.set(null);
    // A hub, so anyone may build; an acting user is still required.
    (App.getUser as Mock).mockReturnValue(actingUser);
    useRoom(createRoom(ROOM_ID));
    placeCameraAt(0.5 * MAX_ROOM_X, 2, 0.5 * MAX_ROOM_Z);
});

// ─── Interruption by the user's own edit ────────────────────────────────────

describe("reselection after the user's own voxel edit", () => {
    it("keeps a selection after adding a block against the selected wall face", () => {
        buildPillar(room, 10, 5);
        const quadIndex = quadIndexOf(10, 5, "x", "+", 2);
        expect(isQuadVisible(room, quadIndex)).toBe(true);

        expect(userAddsBlockAt(room, forceSelect(room, quadIndex))).toBe(true);

        // The new block stands in the neighbouring voxel, and its own outward face takes over.
        const after = currentSelection(room)!;
        expect(after.col).toBe(6);
        expect(after.visible).toBe(true);
    });

    it("keeps a selection after stacking a block on top of the selected one", () => {
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        const quadIndex = quadIndexOf(10, 5, "y", "+", COLLISION_LAYER_MIN);

        expect(userAddsBlockAt(room, forceSelect(room, quadIndex))).toBe(true);

        const after = currentSelection(room)!;
        expect(after.layer).toBe(COLLISION_LAYER_MIN + 1);
        expect(after.visible).toBe(true);
    });

    it("keeps a selection after adding a block onto the room's own floor tile", () => {
        const quadIndex = floorQuadIndexOf(10, 5);
        expect(isQuadVisible(room, quadIndex)).toBe(true);

        expect(userAddsBlockAt(room, forceSelect(room, quadIndex))).toBe(true);

        const after = currentSelection(room)!;
        expect(after.layer).toBe(COLLISION_LAYER_MIN);
        expect(after.visible).toBe(true);
    });

    it("keeps a selection after adding a block under the room's own ceiling tile", () => {
        const quadIndex = ceilingQuadIndexOf(10, 5);
        expect(isQuadVisible(room, quadIndex)).toBe(true);

        expect(userAddsBlockAt(room, forceSelect(room, quadIndex))).toBe(true);

        const after = currentSelection(room)!;
        expect(after.layer).toBe(COLLISION_LAYER_MAX);
        expect(after.visible).toBe(true);
    });

    it("keeps the selection on a low wall as it is carried on from its end", () => {
        // A wall a block thick and a block high, running along x.
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        const end = quadIndexOf(10, 5, "x", "+", COLLISION_LAYER_MIN);

        expect(userAddsBlockAt(room, forceSelect(room, end))).toBe(true);

        // The next stretch of wall stands beyond it, and its own end takes the selection over.
        expect(VoxelQueryUtil.isVoxelBlockPresentAt(room.voxelGrid.voxels, 10, 6, COLLISION_LAYER_MIN)).toBe(true);
        const after = currentSelection(room)!;
        expect([after.row, after.col, after.axis, after.orientation, after.visible]).toEqual([10, 6, "x", "+", true]);
    });

    it("keeps a selection after removing the block whose wall face was selected", () => {
        buildPillar(room, 10, 5);
        const quadIndex = quadIndexOf(10, 5, "x", "+", 2);

        expect(userRemovesBlockAt(room, forceSelect(room, quadIndex))).toBe(true);
        expectSomethingVisibleIsSelected();
    });

    it("keeps a selection after removing a lone block seen from above", () => {
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        const quadIndex = quadIndexOf(10, 5, "y", "+", COLLISION_LAYER_MIN);

        expect(userRemovesBlockAt(room, forceSelect(room, quadIndex))).toBe(true);

        // Nothing is left standing there, so the room's own floor tile takes the selection back.
        const after = currentSelection(room)!;
        expect(after.quadIndex).toBe(floorQuadIndexOf(10, 5));
        expect(after.visible).toBe(true);
    });

    it("keeps a selection after removing the top block of a pillar", () => {
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN + 3);
        const quadIndex = quadIndexOf(10, 5, "y", "+", COLLISION_LAYER_MIN + 3);
        expect(isQuadVisible(room, quadIndex)).toBe(true);

        expect(userRemovesBlockAt(room, forceSelect(room, quadIndex))).toBe(true);

        const after = currentSelection(room)!;
        expect(after.layer).toBe(COLLISION_LAYER_MIN + 2);
        expect(after.visible).toBe(true);
    });

    it("keeps a selection after removing a floating block seen from underneath", () => {
        // A block over empty space: its downward face is selected, pointing at an empty layer.
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN + 2, COLLISION_LAYER_MIN + 2);
        const quadIndex = quadIndexOf(10, 5, "y", "-", COLLISION_LAYER_MIN + 2);
        expect(isQuadVisible(room, quadIndex)).toBe(true);

        expect(userRemovesBlockAt(room, forceSelect(room, quadIndex))).toBe(true);
        expectSomethingVisibleIsSelected();
    });

    it("keeps a selection after removing a block in the room's corner", () => {
        buildPillar(room, WALL_THICKNESS, WALL_THICKNESS);
        const quadIndex = quadIndexOf(WALL_THICKNESS, WALL_THICKNESS, "x", "+", 0);
        expect(isQuadVisible(room, quadIndex)).toBe(true);

        expect(userRemovesBlockAt(room, forceSelect(room, quadIndex))).toBe(true);
        expectSomethingVisibleIsSelected();
    });

    // After a removal the search starts beyond the removed block; for a block at the grid's edge seen from
    // inside that's outside the grid, so coords are clamped back to the removed block's voxel.
    it("keeps a selection after removing a boundary wall block seen from inside", () => {
        // Through the wall from its inner face, a block at a time.
        const gap: number[] = [];
        for (let quadIndex = quadIndexOf(10, WALL_THICKNESS - 1, "x", "+", 3); quadIndex >= 0;
            quadIndex = faceBehind(quadIndex))
        {
            expect(isQuadVisible(room, quadIndex)).toBe(true);
            expect(userRemovesBlockAt(room, forceSelect(room, quadIndex))).toBe(true);
            gap.push(blockIndexOf(quadIndex));
            expectSomethingVisibleIsSelected();

            // The wall it was cut out of is what the user is left looking at, not somewhere else: the same
            // face of the block bared behind, or with none left, a face that lines the gap.
            const after = currentSelection(room)!;
            if (faceBehind(quadIndex) >= 0)
                expect(after.quadIndex).toBe(faceBehind(quadIndex));
            else
                expect(gap).toContain(blockIndexOf(VoxelQueryUtil.getVoxelBlockAddTargetQuadIndex(after.quadIndex)));
        }
        expect(gap.length).toBe(WALL_THICKNESS);
    });

    it("keeps a selection after removing a wall block from each of the four walls", () => {
        // Each wall's innermost block, and the face it shows the room.
        const walls: [number, number, "x" | "z", "-" | "+"][] = [
            [10, WALL_THICKNESS - 1, "x", "+"],                 // west wall, seen from the east
            [10, NUM_VOXEL_COLS - WALL_THICKNESS, "x", "-"],    // east wall, seen from the west
            [WALL_THICKNESS - 1, 10, "z", "+"],                 // north wall, seen from the south
            [NUM_VOXEL_ROWS - WALL_THICKNESS, 10, "z", "-"],    // south wall, seen from the north
        ];
        for (const [row, col, axis, orientation] of walls)
        {
            useRoom(createRoom(ROOM_ID));
            voxelQuadSelectionObservable.set(null);

            // Through to the grid's edge, as above.
            const gap: number[] = [];
            for (let quadIndex = quadIndexOf(row, col, axis, orientation, 3); quadIndex >= 0;
                quadIndex = faceBehind(quadIndex))
            {
                const label = `${orientation}${axis} wall at (${row},${col}), ${gap.length} deep`;
                expect(userRemovesBlockAt(room, forceSelect(room, quadIndex)), label).toBe(true);
                gap.push(blockIndexOf(quadIndex));

                const after = currentSelection(room);
                expect(after, label).not.toBeNull();
                expect(after!.visible, label).toBe(true);
                if (faceBehind(quadIndex) >= 0)
                    expect(after!.quadIndex, label).toBe(faceBehind(quadIndex));
                else
                {
                    expect(gap, label).toContain(
                        blockIndexOf(VoxelQueryUtil.getVoxelBlockAddTargetQuadIndex(after!.quadIndex)));
                }
            }
            expect(gap.length).toBe(WALL_THICKNESS);
        }
    });
});

// ─── The whole wall surface, swept ──────────────────────────────────────────

describe("reselection after removing any wall block in the room", () => {
    // Walks every visible, removable room-facing quad of all four boundary walls and digs on from it to the
    // grid's edge (where the neighbour lies outside the grid), since sampling isn't enough.
    it("never leaves the user with nothing selected, on any of the four walls", () => {
        const lost: string[] = [];
        const hidden: string[] = [];
        let checked = 0;

        // Every voxel of the walls, of which the innermost show their faces to begin with.
        const wallCoords: [number, number][] = [];
        for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
        {
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            {
                if (Math.min(row, col, NUM_VOXEL_ROWS - 1 - row, NUM_VOXEL_COLS - 1 - col) < WALL_THICKNESS)
                    wallCoords.push([row, col]);
            }
        }

        // Each case is undone by re-adding its blocks (exact, since faces are recomputed from the blocks
        // there are), keeping the sweep fast.
        const pristineQuads = Uint8Array.from(room.voxelQuads);
        const pristineBlocks = room.voxelGrid.voxels.map(voxel => voxel.blockLayerMask);

        for (const [row, col] of wallCoords)
        {
            for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
            {
                for (const [axis, orientation] of WALL_FACES)
                {
                    const faceIndex = quadIndexOf(row, col, axis, orientation, layer);
                    if (!isQuadVisible(room, faceIndex))
                        continue;

                    // Through the wall from this face, a block at a time.
                    const removed: {layerStart: number, textures: number[]}[] = [];
                    for (let quadIndex = faceIndex; quadIndex >= 0; quadIndex = faceBehind(quadIndex))
                    {
                        if (!VoxelUpdateUtil.canRemoveVoxelBlock(actingUser, room, quadIndex))
                            break;

                        const layerStart = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(
                            VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
                            VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex), layer);
                        removed.push({layerStart, textures: Array.from({length: NUM_VOXEL_QUADS_PER_COLLISION_LAYER},
                            (_, i) => room.voxelQuads[layerStart + i] & 0b01111111)});

                        voxelQuadSelectionObservable.set(null);
                        ++checked;
                        userRemovesBlockAt(room, forceSelect(room, quadIndex));

                        const after = currentSelection(room);
                        const label = `(${row},${col}) layer ${layer} ${orientation}${axis}, ${removed.length} deep`;
                        if (after == null)
                            lost.push(label);
                        else if (!after.visible)
                            hidden.push(label);
                    }
                    for (const {layerStart, textures} of removed)
                        VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels, layerStart, textures);
                }
            }
        }
        expect(checked).toBeGreaterThan(3600);
        expect(lost).toEqual([]);
        expect(hidden).toEqual([]);
        expect(Array.from(room.voxelQuads)).toEqual(Array.from(pristineQuads));
        expect(room.voxelGrid.voxels.map(voxel => voxel.blockLayerMask)).toEqual(pristineBlocks);
    });
});

// ─── Interruption by another client's edit ──────────────────────────────────

describe("reselection after another client's voxel edit", () => {
    it("keeps a selection when a remote block buries the selected face", async () => {
        buildPillar(room, 10, 5);
        const quadIndex = quadIndexOf(10, 5, "x", "+", 2);
        forceSelect(room, quadIndex);

        // Another client stacks a block right against the face this client had selected.
        await ClientVoxelManager.onAddVoxelBlockSignalReceived(new AddVoxelBlockSignal(
            ROOM_ID, quadIndexOf(10, 6, "x", "+", 2), WALL_TEXTURES));

        expect(isQuadVisible(room, quadIndex)).toBe(false);
        expectSomethingVisibleIsSelected();
    });

    it("keeps a selection when a remote client removes the selected block", async () => {
        buildPillar(room, 10, 5);
        const quadIndex = quadIndexOf(10, 5, "x", "+", 2);
        forceSelect(room, quadIndex);

        await ClientVoxelManager.onRemoveVoxelBlockSignalReceived(
            new RemoveVoxelBlockSignal(ROOM_ID, quadIndex));

        expect(isQuadVisible(room, quadIndex)).toBe(false);
        expectSomethingVisibleIsSelected();
    });

    it("keeps a selection when a remote client removes a boundary wall block", async () => {
        // Through the wall to the grid's edge, a block at a time. Over the wire the ideal quad is the destroyed
        // one, so the search has a voxel to start from.
        for (let quadIndex = quadIndexOf(10, WALL_THICKNESS - 1, "x", "+", 3); quadIndex >= 0;
            quadIndex = faceBehind(quadIndex))
        {
            expect(isQuadVisible(room, quadIndex)).toBe(true);
            forceSelect(room, quadIndex);

            await ClientVoxelManager.onRemoveVoxelBlockSignalReceived(
                new RemoveVoxelBlockSignal(ROOM_ID, quadIndex));

            expect(isQuadVisible(room, quadIndex)).toBe(false);
            expectSomethingVisibleIsSelected();
        }
    });

    it("keeps a selection when a remote client moves the selected block away", async () => {
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        const quadIndex = quadIndexOf(10, 5, "x", "+", COLLISION_LAYER_MIN);
        forceSelect(room, quadIndex);

        await ClientVoxelManager.onMoveVoxelBlockSignalReceived(
            new MoveVoxelBlockSignal(ROOM_ID, quadIndex, 0, 2, 0));

        expect(isQuadVisible(room, quadIndex)).toBe(false);
        expectSomethingVisibleIsSelected();
    });

    it("takes the server's answer to a refused edit: the block as the server holds it, or none", async () => {
        // The user put up a block where the server already held one: their own copy has the textures they
        // gave it, and the answer is the block in the server's (see ServerVoxelManager).
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        const first = quadIndexOf(10, 5, "y", "-", COLLISION_LAYER_MIN);
        forceSelect(room, quadIndexOf(10, 5, "y", "+", COLLISION_LAYER_MIN));

        await ClientVoxelManager.onAddVoxelBlockSignalReceived(
            new AddVoxelBlockSignal(ROOM_ID, first, [7, 6, 5, 4, 3, 2]));
        expect(VoxelQueryUtil.isVoxelBlockPresentAt(room.voxelGrid.voxels, 10, 5, COLLISION_LAYER_MIN)).toBe(true);
        expect(Array.from(room.voxelQuads.subarray(first, first + 6))).toEqual([7, 6, 5, 4, 3, 2]);
        // The same face is still there to be selected.
        expect(currentSelection(room)!.quadIndex).toBe(quadIndexOf(10, 5, "y", "+", COLLISION_LAYER_MIN));

        // A block the user put up where the server holds none is taken away again, and taking away one
        // that is not there (the answer to a move whose block was gone) changes nothing.
        await ClientVoxelManager.onRemoveVoxelBlockSignalReceived(new RemoveVoxelBlockSignal(ROOM_ID, first));
        expect(VoxelQueryUtil.isVoxelBlockPresentAt(room.voxelGrid.voxels, 10, 5, COLLISION_LAYER_MIN)).toBe(false);
        await ClientVoxelManager.onRemoveVoxelBlockSignalReceived(new RemoveVoxelBlockSignal(ROOM_ID, first));
        expect(VoxelQueryUtil.isVoxelBlockPresentAt(room.voxelGrid.voxels, 10, 5, COLLISION_LAYER_MIN)).toBe(false);
        expectSomethingVisibleIsSelected();
    });

    it("holds onto the very same quad when a remote client only retextures it", async () => {
        buildPillar(room, 10, 5);
        const quadIndex = quadIndexOf(10, 5, "x", "+", 2);
        forceSelect(room, quadIndex);

        await ClientVoxelManager.onSetVoxelQuadTextureSignalReceived(
            new SetVoxelQuadTextureSignal(ROOM_ID, quadIndex, 3));

        expect(currentSelection(room)!.quadIndex).toBe(quadIndex);
    });

    it("leaves the selection alone when a remote edit is nowhere near it", async () => {
        buildPillar(room, 10, 5);
        const quadIndex = quadIndexOf(10, 5, "x", "+", 2);
        forceSelect(room, quadIndex);

        await ClientVoxelManager.onAddVoxelBlockSignalReceived(new AddVoxelBlockSignal(
            ROOM_ID, quadIndexOf(20, 20, "y", "+", COLLISION_LAYER_MIN), WALL_TEXTURES));

        expect(currentSelection(room)!.quadIndex).toBe(quadIndex);
    });

    it("keeps a selection when a remote client removes the last block of a lone pillar", async () => {
        buildPillar(room, 16, 16, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        const quadIndex = quadIndexOf(16, 16, "z", "-", COLLISION_LAYER_MIN);
        forceSelect(room, quadIndex);

        await ClientVoxelManager.onRemoveVoxelBlockSignalReceived(
            new RemoveVoxelBlockSignal(ROOM_ID, quadIndex));

        expectSomethingVisibleIsSelected();
    });

    it("keeps a selection when a remote block covers the selected floor tile", async () => {
        const quadIndex = floorQuadIndexOf(10, 5);
        forceSelect(room, quadIndex);

        await ClientVoxelManager.onAddVoxelBlockSignalReceived(new AddVoxelBlockSignal(
            ROOM_ID, quadIndexOf(10, 5, "y", "+", COLLISION_LAYER_MIN), WALL_TEXTURES));

        expect(isQuadVisible(room, quadIndex)).toBe(false);
        expectSomethingVisibleIsSelected();
    });

    it("keeps a selection when a remote block rises against the selected ceiling tile", async () => {
        const quadIndex = ceilingQuadIndexOf(10, 5);
        forceSelect(room, quadIndex);

        await ClientVoxelManager.onAddVoxelBlockSignalReceived(new AddVoxelBlockSignal(
            ROOM_ID, quadIndexOf(10, 5, "y", "-", COLLISION_LAYER_MAX), WALL_TEXTURES));

        expect(isQuadVisible(room, quadIndex)).toBe(false);
        expectSomethingVisibleIsSelected();
    });

    it("keeps a selection while a remote client walls it in on every side", async () => {
        buildPillar(room, 10, 10, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        forceSelect(room, quadIndexOf(10, 10, "y", "+", COLLISION_LAYER_MIN));

        // As far around as a search from it looks.
        for (let row = 10 - SEARCH_REACH; row <= 10 + SEARCH_REACH; ++row)
        {
            for (let col = 10 - SEARCH_REACH; col <= 10 + SEARCH_REACH; ++col)
            {
                for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
                {
                    if (row == 10 && col == 10 && layer == COLLISION_LAYER_MIN)
                        continue;
                    await ClientVoxelManager.onAddVoxelBlockSignalReceived(new AddVoxelBlockSignal(
                        ROOM_ID, quadIndexOf(row, col, "y", "+", layer), WALL_TEXTURES));
                }
            }
        }
        expectSomethingVisibleIsSelected();
    });
});

// ─── Interruption by the selected object going away ─────────────────────────

describe("reselection after the selected object goes away", () => {
    it("selects a nearby quad when a canvas on a free-standing wall is removed", () => {
        buildPillar(room, 10, 5);
        // A canvas hung on the +x face of that wall, about the middle of its layer 2.
        expect(VoxelQuadSelection.trySelectBestQuadNearby(middleOf(quadIndexOf(10, 5, "x", "+", 2)))).toBe(true);
        expectSomethingVisibleIsSelected();
    });

    it("selects a nearby quad when a canvas on the room's boundary wall is removed", () => {
        // The +x face of the westernmost wall looks into the room; a canvas on it sits at x == 1.
        expect(VoxelQuadSelection.trySelectBestQuadNearby({x: 1, y: 1.25, z: 10.5})).toBe(true);
        expectSomethingVisibleIsSelected();
    });

    it("selects a nearby quad when a canvas hangs against the room's ceiling", () => {
        expect(VoxelQuadSelection.trySelectBestQuadNearby({x: 10.5, y: 4, z: 10.5})).toBe(true);
        expectSomethingVisibleIsSelected();
    });

    it("selects a nearby quad when a canvas is walled in by voxels on every side", () => {
        // As far around as a search from it looks.
        for (let row = 10 - SEARCH_REACH; row <= 10 + SEARCH_REACH; ++row)
            for (let col = 10 - SEARCH_REACH; col <= 10 + SEARCH_REACH; ++col)
                buildPillar(room, row, col);

        expect(VoxelQuadSelection.trySelectBestQuadNearby({x: VoxelQueryUtil.getWorldXAtVoxelColCenter(10), y: 1.25,
            z: VoxelQueryUtil.getWorldZAtVoxelRowCenter(10)})).toBe(true);
        expectSomethingVisibleIsSelected();
    });

    it("gives up rather than misfiring when an object sits off the far edge of the grid", () => {
        // A position on the grid's outer boundary finds no voxel, so the search fails; unreachable today
        // (wall attachments can't be placed outside the room).
        expect(VoxelQuadSelection.trySelectBestQuadNearby({x: MAX_ROOM_X, y: 1.25, z: 10.5})).toBe(false);
        expect(VoxelQuadSelection.trySelectBestQuadNearby({x: 10.5, y: 1.25, z: MAX_ROOM_Z})).toBe(false);
    });
});

// ─── What a search settles on ───────────────────────────────────────────────
// Every automatic selection looks around alike: for the nearest quad that is near and at least half clear of
// attached objects; with none such, for an object near there; failing that, for whatever quad is left.

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");

/** A canvas so many world units across and tall, added the way a user's own is. */
function addCanvas(pos: Vec3, dir: Vec3, width: number, height: number): AddObjectSignal
{
    const canvas = new AddObjectSignal(room.id, actingUser.id, actingUser.userName, canvasTypeIndex, "canvas",
        new ObjectTransform(pos, dir, {x: width, y: height, z: 1}), {});
    expect(ObjectUpdateUtil.addObject(actingUser, room, canvas)).toBe(true);
    return canvas;
}

/** The point at a height on the +x face of the pillar at (10, 5), midway across it. */
function onPillarFace(y: number): Vec3
{
    return {...middleOf(quadIndexOf(10, 5, "x", "+", COLLISION_LAYER_MIN)), y};
}

/** Puts the camera before that face, looking straight at it. */
function placeCameraBeforePillar()
{
    const face = onPillarFace(1.5);
    placeCameraAt(face.x + 6, face.y, face.z);
}

/**
 * On the +x face of a pillar at (10, 5), as wide as the pillar and two layers tall, its middle at the given
 * height, with the camera looking straight at it.
 */
function hangCanvasOnPillar(y: number = 1.5): AddObjectSignal
{
    buildPillar(room, 10, 5);
    placeCameraBeforePillar();
    return addCanvas(onPillarFace(y), {x: 1, y: 0, z: 0}, VOXEL_CELL_SIZE, 1);
}

/**
 * Over one side of a wall standing free, a world unit thick and three long, from layer 2 to layer 5: the whole
 * of it, or all but so many blocks at its higher-z end. Every face of the wall near the canvas lies under it; the
 * wall's ends and its far side are clear, and lie just past what a search from the canvas counts as near (see
 * AUTO_SELECTION_MAX_DISTANCE).
 */
function coverWallWithCanvas(numRowsLeftClear: number = 0): AddObjectSignal
{
    const numRows = 3 * VOXELS_PER_WORLD_UNIT, firstRow = 10 - numRows / 2;
    for (let row = firstRow; row < firstRow + numRows; ++row)
    {
        for (let col = 5 - VOXELS_PER_WORLD_UNIT + 1; col <= 5; ++col)
            buildPillar(room, row, col);
    }
    placeCameraBeforePillar();
    const width = (numRows - numRowsLeftClear) * VOXEL_CELL_SIZE;
    return addCanvas({...onPillarFace(2), z: firstRow * VOXEL_CELL_SIZE + 0.5 * width}, {x: 1, y: 0, z: 0}, width, 2);
}

function coverageOf(selection: SelectionSnapshot): number
{
    return ObjectAttachmentUtil.getVoxelQuadCoverage(room, selection.quadIndex);
}

/** Where on the pillar's +x face the selection stands, as its layer. */
function expectPillarFaceSelected(layer: number): SelectionSnapshot
{
    const after = currentSelection(room)!;
    expect([after.row, after.col, `${after.orientation}${after.axis}`, after.layer]).toEqual([10, 5, "+x", layer]);
    expect(after.visible).toBe(true);
    return after;
}

/** The object as the client holds it: only what selecting one reads of it. */
function gameObjectOf(object: AddObjectSignal, selectable: boolean = true): GameObject
{
    const pos = object.transform.pos;
    return {
        params: object,
        position: new THREE.Vector3(pos.x, pos.y, pos.z),
        quaternion: new THREE.Quaternion(),
        canBeSelected: () => selectable,
    } as unknown as GameObject;
}

// A selection's outline is made on first use, and it takes over from the other kind only once made.
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe("what an automatic selection settles on", () => {
    let objectLookup: MockInstance | undefined;

    /** Makes the client hold these objects, as it does once they are spawned. */
    function clientHolds(...gameObjects: GameObject[])
    {
        objectLookup = vi.spyOn(ClientObjectManager, "getObjectById").mockImplementation(
            objectId => gameObjects.find(gameObject => gameObject.params.objectId == objectId));
    }

    afterEach(() => {
        objectLookup?.mockRestore();
        objectLookup = undefined;
    });

    it("passes over a face an object mostly covers for one right by it", () => {
        // Over layers 2 and 3, whole.
        const canvas = hangCanvasOnPillar();

        expect(VoxelQuadSelection.trySelectBestQuadNearby(canvas.transform.pos)).toBe(true);

        // Straight above the canvas, on the same side of the pillar.
        expect(coverageOf(expectPillarFaceSelected(4))).toBe(0);
    });

    it("counts a face up to half covered as clear, so the nearer of them wins", () => {
        // Over layer 2, and half of layers 1 and 3.
        const canvas = hangCanvasOnPillar(1.25);

        expect(VoxelQuadSelection.trySelectBestQuadNearby(canvas.transform.pos)).toBe(true);

        // Not the face it covers whole, which is as near; nor a clear one further off.
        expect(coverageOf(expectPillarFaceSelected(3))).toBe(0.5);
    });

    it("takes the face an object lay on once the room no longer holds the object", () => {
        // As the removal handlers ask: after the object has left the room, so its own face counts as clear.
        const canvas = hangCanvasOnPillar();
        expect(ObjectUpdateUtil.removeObject(actingUser, room, new RemoveObjectSignal(room.id, canvas.objectId)))
            .toBe(true);

        expect(VoxelQuadSelection.trySelectBestQuadNearby(canvas.transform.pos)).toBe(true);

        expectPillarFaceSelected(3);
    });

    it("holds a quad asked for by name to the same test as the rest", () => {
        // A lone block with a canvas lying on its top, all over it.
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        const top = quadIndexOf(10, 5, "y", "+", COLLISION_LAYER_MIN);
        addCanvas(middleOf(top), {x: 0, y: 1, z: 0}, VOXEL_CELL_SIZE, VOXEL_CELL_SIZE);

        expect(VoxelQuadSelection.trySelectBestQuad(voxelAt(room, 10, 5), top)).toBe(true);

        // One of the block's sides, rather than the top the canvas covers.
        const after = currentSelection(room)!;
        expect(after.quadIndex).not.toBe(top);
        expect([after.row, after.col, after.layer]).toEqual([10, 5, COLLISION_LAYER_MIN]);
        expect(coverageOf(after)).toBe(0);
    });

    it("takes an object near there when no quad near is clear enough", async () => {
        const canvas = coverWallWithCanvas();
        const gameObject = gameObjectOf(canvas);
        clientHolds(gameObject);

        // The wall's far side and the floor are clear, but out of reach.
        expect(VoxelQuadSelection.trySelectBestQuadNearby(canvas.transform.pos)).toBe(true);
        await settle();

        expect(objectSelectionObservable.peek()?.gameObject).toBe(gameObject);
        expect(VoxelQuadSelection.isSelected()).toBe(false);
    });

    it("takes a clear face a world unit along the wall before an object nearer by", async () => {
        // The canvas stops a unit short of the wall's end, and the search looks from under it, a unit and a
        // quarter before the middle of the first face left clear.
        const canvas = coverWallWithCanvas(VOXELS_PER_WORLD_UNIT);
        clientHolds(gameObjectOf(canvas));
        const canvasEndZ = canvas.transform.pos.z + 0.5 * canvas.transform.scale.x;
        const firstClearRow = VoxelQueryUtil.getVoxelRowFromWorldZ(canvasEndZ);

        expect(VoxelQuadSelection.trySelectBestQuadNearby({...canvas.transform.pos, z: canvasEndZ - 0.75})).toBe(true);
        await settle();

        expect(ObjectSelection.isSelected()).toBe(false);
        const after = currentSelection(room)!;
        expect([after.row, after.col, `${after.orientation}${after.axis}`]).toEqual([firstClearRow, 5, "+x"]);
        expect(coverageOf(after)).toBe(0);
    });

    it("takes a quad further off, a clear one first, when the user may select no object near there", async () => {
        const canvas = coverWallWithCanvas();
        clientHolds(gameObjectOf(canvas, false));

        expect(VoxelQuadSelection.trySelectBestQuadNearby(canvas.transform.pos)).toBe(true);
        await settle();

        expect(ObjectSelection.isSelected()).toBe(false);
        // Not one of the faces the canvas covers, near as they are.
        const after = currentSelection(room)!;
        expect(coverageOf(after)).toBe(0);
        expect(after.visible).toBe(true);
    });
});

// ─── Going on from a selected object ────────────────────────────────────────
// A search for a face near a selected object takes the selection over from it, unless a step holds the selection
// of faces still.

describe("reselection from a selected object", () => {
    it("takes the selection over from the object", async () => {
        const canvas = hangCanvasOnPillar();
        expect(ObjectSelection.trySelect(gameObjectOf(canvas))).toBe(true);
        await settle();
        expect(ObjectSelection.isSelected()).toBe(true);

        expect(VoxelQuadSelection.trySelectBestQuadNearby(canvas.transform.pos)).toBe(true);
        await settle();

        expect(ObjectSelection.isSelected()).toBe(false);
        expectPillarFaceSelected(4);
    });

    it("leaves the selection on the object while a step holds the selection of faces still", async () => {
        const canvas = hangCanvasOnPillar();
        const gameObject = gameObjectOf(canvas);
        expect(ObjectSelection.trySelect(gameObject)).toBe(true);
        await settle();
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableVoxelQuadSelectionChange);

        expect(VoxelQuadSelection.trySelectBestQuadNearby(canvas.transform.pos)).toBe(false);
        await settle();

        expect(objectSelectionObservable.peek()?.gameObject).toBe(gameObject);
        expect(VoxelQuadSelection.isSelected()).toBe(false);
    });
});

// ─── Interruptions that are meant to end the selection ──────────────────────

describe("interruptions that are meant to leave nothing selected", () => {
    it("drops the selection when the room changes", () => {
        buildPillar(room, 10, 5);
        forceSelect(room, quadIndexOf(10, 5, "x", "+", 2));

        roomChangedObservable.set(new RoomRuntimeMemory(room, {}));

        expect(voxelQuadSelectionObservable.peek()).toBeNull();
    });

    it("drops the selection when everything is unselected at once", () => {
        buildPillar(room, 10, 5);
        forceSelect(room, quadIndexOf(10, 5, "x", "+", 2));

        WorldSpaceSelectionUtil.unselectAll();

        expect(voxelQuadSelectionObservable.peek()).toBeNull();
    });
});

// ─── Interruptions while selection changes are held back ────────────────────
// The tutorial's freeze also blocks auto-reselection, so the outline stays on a buried or destroyed quad
// until the step moves it (via its own "select_voxel_quad" action).

describe("interruptions while selection changes are disabled", () => {
    it("holds the selection in place when the user's own edit destroys the quad", () => {
        buildPillar(room, 10, 5);
        const quadIndex = quadIndexOf(10, 5, "x", "+", 2);
        const selection = forceSelect(room, quadIndex);
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableVoxelQuadSelectionChange);

        expect(userRemovesBlockAt(room, selection)).toBe(true);

        expect(isQuadVisible(room, quadIndex)).toBe(false);
        expect(currentSelection(room)!.quadIndex).toBe(quadIndex);
    });

    it("holds the selection in place when the user's own edit buries the quad", () => {
        buildPillar(room, 10, 5);
        const quadIndex = quadIndexOf(10, 5, "x", "+", 2);
        const selection = forceSelect(room, quadIndex);
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableVoxelQuadSelectionChange);

        expect(userAddsBlockAt(room, selection)).toBe(true);

        expect(isQuadVisible(room, quadIndex)).toBe(false);
        expect(currentSelection(room)!.quadIndex).toBe(quadIndex);
    });

    it("holds the selection in place when a remote edit destroys the quad", async () => {
        buildPillar(room, 10, 5);
        const quadIndex = quadIndexOf(10, 5, "x", "+", 2);
        forceSelect(room, quadIndex);
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableAllSelectionChange);

        await ClientVoxelManager.onRemoveVoxelBlockSignalReceived(
            new RemoveVoxelBlockSignal(ROOM_ID, quadIndex));

        expect(isQuadVisible(room, quadIndex)).toBe(false);
        expect(currentSelection(room)!.quadIndex).toBe(quadIndex);
    });
});

// ─── Selection narrowed to a single quad ────────────────────────────────────
// A scripted step can ask the user to pick out one face and have the room refuse the rest (see
// voxelQuadSelectionRestrictionObservable), which is narrower than freezing the selection outright.

describe("selection restricted to one quad", () => {
    it("takes the allowed quad and refuses every other", () => {
        buildPillar(room, 10, 5);
        const allowed = quadIndexOf(10, 5, "x", "+", 2);
        const other = quadIndexOf(10, 5, "z", "+", 2);
        voxelQuadSelectionRestrictionObservable.set(allowed);

        expect(VoxelQuadSelection.trySelect(voxelAt(room, 10, 5), other)).toBe(false);
        expect(voxelQuadSelectionObservable.peek()).toBeNull();

        expect(VoxelQuadSelection.trySelect(voxelAt(room, 10, 5), allowed)).toBe(true);
        expect(currentSelection(room)!.quadIndex).toBe(allowed);
    });

    it("gives the rest of the room back once the restriction is cleared", () => {
        buildPillar(room, 10, 5);
        const other = quadIndexOf(10, 5, "z", "+", 2);
        voxelQuadSelectionRestrictionObservable.set(quadIndexOf(10, 5, "x", "+", 2));
        voxelQuadSelectionRestrictionObservable.set(null);

        expect(VoxelQuadSelection.trySelect(voxelAt(room, 10, 5), other)).toBe(true);
        expect(currentSelection(room)!.quadIndex).toBe(other);
    });
});
