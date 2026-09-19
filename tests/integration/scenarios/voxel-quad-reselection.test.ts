/**
 * Scenario tests: voxelQuad auto-reselection. When a selection is interrupted (the user's own edit,
 * another client's edit, or the selected object going away), a nearby visible quad is selected instead.
 * Browser-bound client modules are stubbed; generation, update rules and the search run for real.
 */
import { describe, it, expect, beforeEach, vi, Mock } from "vitest";

vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const camera = new THREE.PerspectiveCamera();
    const scene = new THREE.Scene();
    // Voxel edits invalidate the light map (see LightBlockMap); a stub suffices.
    const lightBlockMap = { requestRecomputation() {}, resetForRoom(_voxels?: unknown) {},
        getNearbyLightAt(_worldPos: unknown, out: any) { return out.setRGB(0, 0, 0); } };
    return { default: { getCamera: () => camera, getScene: () => scene,
        getLightBlockMap: () => lightBlockMap,
        setViewDistance: () => {}, setPointLightSurroundings: () => {},
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

import App from "../../../src/client/app";
import GraphicsManager from "../../../src/client/graphics/graphicsManager";
import VoxelQuadSelection from "../../../src/client/graphics/types/gizmo/voxelQuadSelection";
import ClientVoxelManager from "../../../src/client/voxel/clientVoxelManager";
import { clientFeatureFlagsObservable, gameModeObservable, roomChangedObservable,
    voxelQuadSelectionObservable,
    voxelQuadSelectionRestrictionObservable } from "../../../src/client/system/clientObservables";
import WorldSpaceSelectionUtil from "../../../src/client/graphics/util/worldSpaceSelectionUtil";
import { FeatureFlag } from "../../../src/shared/system/types/featureFlag";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS, NUM_VOXEL_ROWS,
    NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../../src/shared/system/sharedConstants";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import AddVoxelBlockSignal from "../../../src/shared/voxel/types/update/addVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/removeVoxelBlockSignal";
import MoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/moveVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../../src/shared/voxel/types/update/setVoxelQuadTextureSignal";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import Room from "../../../src/shared/room/types/room";
import RoomRuntimeMemory from "../../../src/shared/room/types/roomRuntimeMemory";
import { createEditingUser } from "../helpers/mockUser";
import {
    buildPillar, ceilingQuadIndexOf, createRoom, currentSelection, floorQuadIndexOf, forceSelect,
    isQuadVisible, quadIndexOf, userAddsBlockAt, userRemovesBlockAt, voxelAt,
} from "../helpers/selectionHarness";

// The acting user (editing utilities require one).
const actingUser = createEditingUser();

const ROOM_ID = "reselection-room";
const WALL_TEXTURES = [1, 1, 1, 1, 1, 1];
const WALL_FACES: ["x" | "z", "-" | "+"][] = [["x", "-"], ["x", "+"], ["z", "-"], ["z", "+"]];

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
    // A hub, so anyone may build; an acting user is still required.
    (App.getUser as Mock).mockReturnValue(actingUser);
    useRoom(createRoom(ROOM_ID));
    placeCameraAt(NUM_VOXEL_COLS * 0.5, 2, NUM_VOXEL_ROWS * 0.5);
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
        buildPillar(room, 1, 1);
        const quadIndex = quadIndexOf(1, 1, "x", "+", 0);

        expect(userRemovesBlockAt(room, forceSelect(room, quadIndex))).toBe(true);
        expectSomethingVisibleIsSelected();
    });

    // After a removal the search starts beyond the removed block; for a boundary block seen from inside
    // that's outside the grid, so coords are clamped back to the removed block's voxel.
    it("keeps a selection after removing a boundary wall block seen from inside", () => {
        const quadIndex = quadIndexOf(10, 0, "x", "+", 3);
        expect(isQuadVisible(room, quadIndex)).toBe(true);

        expect(userRemovesBlockAt(room, forceSelect(room, quadIndex))).toBe(true);
        expectSomethingVisibleIsSelected();

        // The wall it was cut out of is what the user is left looking at, not somewhere else.
        const after = currentSelection(room)!;
        expect([after.row, after.col]).toEqual([10, 0]);
        expect(`${after.orientation}${after.axis}`).toBe("+x");
    });

    it("keeps a selection after removing a wall block from each of the four walls", () => {
        const walls: [number, number, "x" | "z", "-" | "+"][] = [
            [10, 0, "x", "+"],                     // west wall, seen from the east
            [10, NUM_VOXEL_COLS - 1, "x", "-"],    // east wall, seen from the west
            [0, 10, "z", "+"],                     // north wall, seen from the south
            [NUM_VOXEL_ROWS - 1, 10, "z", "-"],    // south wall, seen from the north
        ];
        for (const [row, col, axis, orientation] of walls)
        {
            useRoom(createRoom(ROOM_ID));
            voxelQuadSelectionObservable.set(null);
            const quadIndex = quadIndexOf(row, col, axis, orientation, 3);
            expect(userRemovesBlockAt(room, forceSelect(room, quadIndex))).toBe(true);

            const after = currentSelection(room);
            expect(after, `${orientation}${axis} wall at (${row},${col})`).not.toBeNull();
            expect(after!.visible, `${orientation}${axis} wall at (${row},${col})`).toBe(true);
            expect([after!.row, after!.col]).toEqual([row, col]);
        }
    });
});

// ─── The whole wall surface, swept ──────────────────────────────────────────

describe("reselection after removing any wall block in the room", () => {
    // Walks every visible, removable room-facing quad of all four boundary walls (where the neighbour
    // lies outside the grid), since sampling isn't enough.
    it("never leaves the user with nothing selected, on any of the four walls", () => {
        const lost: string[] = [];
        const hidden: string[] = [];
        let checked = 0;

        const wallCoords: [number, number][] = [];
        for (let col = 0; col < NUM_VOXEL_COLS; ++col)
        {
            wallCoords.push([0, col]);
            wallCoords.push([NUM_VOXEL_ROWS - 1, col]);
        }
        for (let row = 1; row < NUM_VOXEL_ROWS - 1; ++row)
        {
            wallCoords.push([row, 0]);
            wallCoords.push([row, NUM_VOXEL_COLS - 1]);
        }

        // Each case is undone by re-adding the block (exact, since faces are recomputed from the collision
        // mask), keeping the sweep fast.
        const pristineQuads = Uint8Array.from(room.voxelQuads);

        for (const [row, col] of wallCoords)
        {
            for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
            {
                for (const [axis, orientation] of WALL_FACES)
                {
                    const quadIndex = quadIndexOf(row, col, axis, orientation, layer);
                    if (!isQuadVisible(room, quadIndex))
                        continue;
                    if (!VoxelUpdateUtil.canRemoveVoxelBlock(actingUser, room, quadIndex))
                        continue;

                    const layerStart = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, layer);
                    const textures = Array.from({length: NUM_VOXEL_QUADS_PER_COLLISION_LAYER},
                        (_, i) => room.voxelQuads[layerStart + i] & 0b01111111);

                    voxelQuadSelectionObservable.set(null);
                    ++checked;
                    userRemovesBlockAt(room, forceSelect(room, quadIndex));

                    const after = currentSelection(room);
                    const label = `(${row},${col}) layer ${layer} ${orientation}${axis}`;
                    if (after == null)
                        lost.push(label);
                    else if (!after.visible)
                        hidden.push(label);

                    VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels,
                        quadIndexOf(row, col, "y", "+", layer), textures);
                }
            }
        }
        expect(checked).toBeGreaterThan(900);
        expect(lost).toEqual([]);
        expect(hidden).toEqual([]);
        expect(Array.from(room.voxelQuads)).toEqual(Array.from(pristineQuads));
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
        // Over the wire the ideal quad is the destroyed one, so the search has a voxel to start from.
        const quadIndex = quadIndexOf(10, 0, "x", "+", 3);
        forceSelect(room, quadIndex);

        await ClientVoxelManager.onRemoveVoxelBlockSignalReceived(
            new RemoveVoxelBlockSignal(ROOM_ID, quadIndex));

        expectSomethingVisibleIsSelected();
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

        for (let row = 9; row <= 11; ++row)
        {
            for (let col = 9; col <= 11; ++col)
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
        // A canvas hangs off the +x face of that wall, half a unit out from it.
        expect(VoxelQuadSelection.trySelectBestQuadNearby({x: 6, y: 1.25, z: 10.5})).toBe(true);
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
        for (let row = 9; row <= 11; ++row)
            for (let col = 9; col <= 11; ++col)
                buildPillar(room, row, col);

        expect(VoxelQuadSelection.trySelectBestQuadNearby({x: 10.5, y: 1.25, z: 10.5})).toBe(true);
        expectSomethingVisibleIsSelected();
    });

    it("gives up rather than misfiring when an object sits off the far edge of the grid", () => {
        // A position on the grid's outer boundary finds no voxel, so the search fails; unreachable today
        // (wall attachments can't be placed outside the room).
        expect(VoxelQuadSelection.trySelectBestQuadNearby({x: NUM_VOXEL_COLS, y: 1.25, z: 10.5})).toBe(false);
        expect(VoxelQuadSelection.trySelectBestQuadNearby({x: 10.5, y: 1.25, z: NUM_VOXEL_ROWS})).toBe(false);
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
