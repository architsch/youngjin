/**
 * Helpers for the voxelQuad auto-reselection scenarios.
 *
 * The reselection logic lives on the client, so these tests drive the real client modules
 * (VoxelQuadSelection, ClientVoxelManager) against a really generated room. The test file that
 * uses this helper must stub out the three client modules that need a browser
 * (graphicsManager, app, worldSpaceOutlineRect) BEFORE importing anything from here.
 */
import Room from "../../../src/shared/room/types/room";
import RoomRuntimeMemory from "../../../src/shared/room/types/roomRuntimeMemory";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import { RoomType, RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import Voxel from "../../../src/shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS, NUM_VOXEL_ROWS,
    NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../../src/shared/system/sharedConstants";
import NumUtil from "../../../src/shared/math/util/numUtil";
import { voxelQuadSelectionObservable } from "../../../src/client/system/clientObservables";
import VoxelQuadSelection from "../../../src/client/graphics/types/gizmo/voxelQuadSelection";
import { createTestRoom } from "./roomContent";
import { createEditingUser } from "./mockUser";

export type FacingAxis = "x" | "y" | "z";
export type Orientation = "-" | "+";

// Who these helpers act as. They stand in for a user editing a room by hand, and the editing
// utilities want the person as well as the role he holds.
const actingUser = createEditingUser();

/**
 * A freshly built room of the given type, ready to be handed to the App stub. The room is
 * registered with the physics engine too, since the voxel-removal rules consult it in order to
 * find any wall-attached object that would lose its support.
 */
export function createRoom(id: string = "test-room", type: RoomType = RoomTypeEnumMap.Hub): Room
{
    const room = createTestRoom(id, id, type, "owner-user", "Owner", "default");
    if (PhysicsManager.hasRoom(id))
        PhysicsManager.unload(id);
    PhysicsManager.load(new RoomRuntimeMemory(room, {}));
    return room;
}

export function voxelAt(room: Room, row: number, col: number): Voxel
{
    return VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col)!;
}

export function quadIndexOf(row: number, col: number, axis: FacingAxis,
    orientation: Orientation, layer: number): number
{
    return VoxelQueryUtil.getVoxelQuadIndex(row, col, axis, orientation, layer);
}

/** The room's own floor tile under a voxel (belongs to no collision layer). */
export function floorQuadIndexOf(row: number, col: number): number
{
    return VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(row, col) +
        NUM_VOXEL_QUADS_PER_COLLISION_LAYER * (COLLISION_LAYER_MAX + 1) + 1;
}

/** The room's own ceiling tile over a voxel (belongs to no collision layer). */
export function ceilingQuadIndexOf(row: number, col: number): number
{
    return VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(row, col) +
        NUM_VOXEL_QUADS_PER_COLLISION_LAYER * (COLLISION_LAYER_MAX + 1);
}

export function isQuadVisible(room: Room, quadIndex: number): boolean
{
    return (room.voxelQuads[quadIndex] & 0b10000000) != 0;
}

/** Selects a quad outright, bypassing the "select the same quad twice unselects it" rule. */
export function forceSelect(room: Room, quadIndex: number): VoxelQuadSelection
{
    const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
    const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
    const selection = new VoxelQuadSelection(voxelAt(room, row, col), quadIndex);
    voxelQuadSelectionObservable.set(selection);
    return selection;
}

export interface SelectionSnapshot
{
    row: number;
    col: number;
    quadIndex: number;
    axis: FacingAxis;
    orientation: Orientation;
    layer: number;
    visible: boolean;
}

export function currentSelection(room: Room): SelectionSnapshot | null
{
    const selection = voxelQuadSelectionObservable.peek();
    if (!selection)
        return null;
    return {
        row: selection.voxel.row,
        col: selection.voxel.col,
        quadIndex: selection.quadIndex,
        axis: VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(selection.quadIndex),
        orientation: VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(selection.quadIndex),
        layer: VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(selection.quadIndex),
        visible: isQuadVisible(room, selection.quadIndex),
    };
}

/** Builds a solid pillar of blocks, the way a user would stack them by hand. */
export function buildPillar(room: Room, row: number, col: number,
    layerMin: number = COLLISION_LAYER_MIN, layerMax: number = COLLISION_LAYER_MAX)
{
    for (let layer = layerMin; layer <= layerMax; ++layer)
    {
        VoxelUpdateUtil.addVoxelBlock(actingUser, room.voxelGrid.voxels,
            quadIndexOf(row, col, "y", "+", layer), [1, 1, 1, 1, 1, 1], room);
    }
}

// ─── Mirrors of the placement menu's own derivation ────────────────────────
// The two buttons that interrupt a voxelQuad selection live inside a React component
// (voxelQuadPlacementOptions.tsx) whose handlers are module-private, so the sequence each one
// performs is reproduced here. Keep these in step with that component.

/** What the "add block" button does: place a block against the selected face, then reselect. */
export function userAddsBlockAt(room: Room, selection: VoxelQuadSelection): boolean
{
    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const axis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
    const layer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

    let newRow = voxel.row;
    let newCol = voxel.col;
    if (axis == "z")
        newRow += (orientation == "+") ? 1 : -1;
    else if (axis == "x")
        newCol += (orientation == "+") ? 1 : -1;

    let newLayer = layer;
    if (axis == "y")
    {
        if (layer < COLLISION_LAYER_MIN || layer > COLLISION_LAYER_MAX)
            newLayer = (orientation == "+") ? COLLISION_LAYER_MIN : COLLISION_LAYER_MAX;
        else
            newLayer += (orientation == "+") ? 1 : -1;
    }

    const textures = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
    const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(voxel.row, voxel.col, layer);
    for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
        textures[i - startIndex] = room.voxelQuads[i] & 0b01111111;

    const idealQuadIndex = quadIndexOf(newRow, newCol, axis, orientation, newLayer);
    if (!VoxelUpdateUtil.addVoxelBlock(actingUser, room.voxelGrid.voxels,
        idealQuadIndex, textures, room))
    {
        return false;
    }
    VoxelQuadSelection.unselect();
    const idealVoxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, newRow, newCol);
    if (idealVoxel)
        VoxelQuadSelection.trySelectBestQuad(idealVoxel, idealQuadIndex);
    return true;
}

/** What the "remove block" button does: remove the selected block, then reselect. */
export function userRemovesBlockAt(room: Room, selection: VoxelQuadSelection): boolean
{
    const quadIndex = selection.quadIndex;
    if (!VoxelUpdateUtil.removeVoxelBlock(actingUser, room.voxelGrid.voxels,
        quadIndex, room))
    {
        return false;
    }
    VoxelQuadSelection.unselect();

    const axis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
    const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
    const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
    const layer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

    const newRow = NumUtil.clampInRange(
        (axis == "z") ? (orientation == "-" ? row+1 : row-1) : row,
        0, NUM_VOXEL_ROWS-1);
    const newCol = NumUtil.clampInRange(
        (axis == "x") ? (orientation == "-" ? col+1 : col-1) : col,
        0, NUM_VOXEL_COLS-1);
    const newLayer = (axis == "y")
        ? VoxelQueryUtil.getVoxelQuadCollisionLayerAfterOffset(quadIndex, (orientation == "-") ? 1 : -1)
        : layer;

    const idealQuadIndex = quadIndexOf(newRow, newCol, axis, orientation, newLayer);
    const idealVoxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, newRow, newCol);
    if (idealVoxel)
        VoxelQuadSelection.trySelectBestQuad(idealVoxel, idealQuadIndex);
    return true;
}
