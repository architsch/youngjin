import * as THREE from "three";
import VoxelQuadSelection from "./voxelQuadSelection";
import WorldSpaceOutlineRect from "./generic/worldSpaceOutlineRect";
import SelectionEditDrag from "./drag/selectionEditDrag";
import SelectionEditGizmoProvider from "./drag/selectionEditGizmoProvider";
import SelectionEditGizmoUtil from "../../util/selectionEditGizmoUtil";
import PointerCoordUtil from "../../util/pointerCoordUtil";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import ClientVoxelManager from "../../../voxel/clientVoxelManager";
import GameModeUtil from "../../../system/util/gameModeUtil";
import { clientFeatureFlagsObservable, gameModeObservable, roomChangedObservable, voxelBlockPreviewObservable,
    voxelQuadSelectionObservable, voxelQuadSelectionRestrictionObservable } from "../../../system/clientObservables";
import Room from "../../../../shared/room/types/room";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../../shared/voxel/util/voxelUpdateUtil";
import VoxelBlockShapeUtil from "../../../../shared/voxel/util/voxelBlockShapeUtil";
import SetVoxelBlockShapeSignal from "../../../../shared/voxel/types/update/setVoxelBlockShapeSignal";
import Geometry3DUtil from "../../../../shared/math/util/geometry3DUtil";
import Vec3 from "../../../../shared/math/types/vec3";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, VOXEL_BLOCK_SHAPE_EMPTY } from "../../../../shared/system/sharedConstants";
import { FeatureFlag } from "../../../../shared/system/types/featureFlag";

// Reshaping the block of the selected voxel quad by the quad's selection outline (see
// SelectionEditGizmoUtil). A handle on an edge of the outline moves the bound of the block that the edge
// is, between its cell's side and the middle of its cell. The face itself takes no drag, so one that starts
// on it turns the view. An edit previews locally and reaches the server as one, on release (see
// ClientVoxelManager.previewVoxelBlockShape).

// How far past halfway between its two places the pointer has to carry a bound before it goes over, as a
// share of the cell, so that it doesn't flutter there.
const RESIZE_DEAD_BAND = 0.05;

// Scripted steps that keep the room's blocks or the selection as they are (a reshape can hide the selected
// face, which sends the selection to another of the block's).
const STAND_DOWN_FLAGS = [FeatureFlag.DisableManualVoxelBlockResize, FeatureFlag.DisableVoxelQuadSelectionChange,
    FeatureFlag.DisableAllSelectionChange];

// A block's faces in the order the selection tries them, when the one it was on no longer shows.
const FALLBACK_FACES: {facingAxis: "x" | "y" | "z", orientation: "-" | "+"}[] = [
    {facingAxis: "y", orientation: "+"}, {facingAxis: "x", orientation: "-"}, {facingAxis: "x", orientation: "+"},
    {facingAxis: "z", orientation: "-"}, {facingAxis: "z", orientation: "+"}, {facingAxis: "y", orientation: "-"},
];

// The selection, when it is a face of a block this user may reshape (refreshed whenever it is
// re-announced).
let target: VoxelQuadSelection | null = null;

// The cell layer of the block the latest drag began on; left as it was once that drag is over.
let draggedBlock = {row: 0, col: 0, collisionLayer: 0};

// One handle for each bound a block can be resized by, placed whenever the handles are asked for.
const boundHandles: {id: string, axis: "x" | "z", orientation: "-" | "+", position: THREE.Vector3}[] = [
    {id: "minX", axis: "x", orientation: "-", position: new THREE.Vector3()},
    {id: "maxX", axis: "x", orientation: "+", position: new THREE.Vector3()},
    {id: "minZ", axis: "z", orientation: "-", position: new THREE.Vector3()},
    {id: "maxZ", axis: "z", orientation: "+", position: new THREE.Vector3()},
];
const shownHandles: typeof boundHandles = [];

const outlineCorners = [{x: -1, y: -1}, {x: 1, y: -1}, {x: 1, y: 1}, {x: -1, y: 1}]
    .map(corner => ({corner, position: new THREE.Vector3()}));

const hitTemp = new THREE.Vector3();
const pointTemp = new THREE.Vector3();
const middleTemp = new THREE.Vector3();
const screenTemp = new THREE.Vector2();

const VoxelQuadEditGizmos: SelectionEditGizmoProvider =
{
    // On the edges of the outline that are bounds of the block along x or z, which are those across the way
    // the face looks, and of those on the ones that have another place to go.
    getHandles: () =>
    {
        shownHandles.length = 0;
        const room = App.getCurrentRoom();
        if (target == null || room == undefined)
            return shownHandles;

        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(target.quadIndex);
        const shape = getBlockShape(target);
        const bounds = VoxelBlockShapeUtil.getBounds(shape);
        const {center} = getFace(room, target);
        for (const handle of boundHandles)
        {
            if (handle.axis == facingAxis || getResizedShape(shape, handle.axis, handle.orientation) == VOXEL_BLOCK_SHAPE_EMPTY)
                continue;
            const size = (handle.axis == "x") ? bounds.maxX - bounds.minX : bounds.maxZ - bounds.minZ;
            const reach = ((handle.orientation == "+") ? 1 : -1) * WorldSpaceOutlineRect.getEdgeOffset(size);
            handle.position.set(center.x + ((handle.axis == "x") ? reach : 0), center.y,
                center.z + ((handle.axis == "z") ? reach : 0));
            shownHandles.push(handle);
        }
        return shownHandles;
    },

    pickHandle: (handleIndex: number, ev: PointerEvent, handleScreen: {x: number, y: number}) =>
    {
        const selection = target!;
        const handle = shownHandles[handleIndex];
        // The cursor's arrow runs the way the handle lies from the face's middle on screen.
        const {center} = getFace(App.getCurrentRoom()!, selection);
        const middle = PointerCoordUtil.worldToClient(pointTemp.set(center.x, center.y, center.z), screenTemp);
        const sideways = middle == null ||
            Math.abs(handleScreen.x - middle.x) >= Math.abs(handleScreen.y - middle.y);
        return {cursor: sideways ? "ew-resize" : "ns-resize", begin: () => beginResize(selection, ev, handle)};
    },

    pickBody: () => null,

    getOutline: () =>
    {
        const room = App.getCurrentRoom();
        if (target == null || room == undefined)
            return null;
        const {center, dir, reachRight, reachUp} = getFace(room, target);
        const {right, up} = Geometry3DUtil.getAxisFacingBasis(dir);
        for (const {corner, position} of outlineCorners)
        {
            const alongRight = corner.x * reachRight;
            const alongUp = corner.y * reachUp;
            position.set(center.x + right.x * alongRight + up.x * alongUp, center.y + right.y * alongRight + up.y * alongUp,
                center.z + right.z * alongRight + up.z * alongUp);
        }
        return {middle: middleTemp.set(center.x, center.y, center.z), corners: outlineCorners};
    },
}

// ─── What a press can take hold of ──────────────────────────────────────

function findTarget(): VoxelQuadSelection | null
{
    if (!GameModeUtil.isInEditMode() || STAND_DOWN_FLAGS.some(flag => clientFeatureFlagsObservable.has(flag)) ||
        voxelQuadSelectionRestrictionObservable.peek() != null)
    {
        return null;
    }
    const room = App.getCurrentRoom();
    const selection = voxelQuadSelectionObservable.peek();
    if (!room || !selection)
        return null;

    // (The room's own floor and ceiling are no block's faces.)
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(selection.quadIndex);
    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        return null;
    // Asked of the shape it has, so this comes down to whether this user may edit the block at all.
    const shape = getBlockShape(selection);
    if (!VoxelUpdateUtil.canSetVoxelBlockShape(App.getUser(), room, selection.quadIndex, shape))
        return null;
    return selection;
}

function getBlockShape(selection: VoxelQuadSelection): number
{
    return VoxelQueryUtil.getVoxelBlockShape(selection.voxel,
        VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(selection.quadIndex));
}

// The selected face as the grid has it, drawn or not: its middle, the way it looks, and how far the outline
// reaches from the middle along the face's right and up.
function getFace(room: Room, selection: VoxelQuadSelection): {center: Vec3, dir: Vec3, reachRight: number, reachUp: number}
{
    const dims = VoxelQueryUtil.getVoxelQuadTransformDimensions(room.voxelGrid.voxels, selection.quadIndex, true);
    return {
        center: {x: selection.voxel.col + 0.5 + dims.offsetX, y: dims.offsetY, z: selection.voxel.row + 0.5 + dims.offsetZ},
        dir: {x: dims.dirX, y: dims.dirY, z: dims.dirZ},
        reachRight: WorldSpaceOutlineRect.getEdgeOffset(dims.scaleX),
        reachUp: WorldSpaceOutlineRect.getEdgeOffset(dims.scaleY),
    };
}

// The shape with one of its bounds in the other of that bound's two places (see
// VoxelBlockShapeUtil.moveBound), or the empty shape if it has no other: a block half as wide as its cell
// has a bound at the cell's side, which can neither come in nor go out.
function getResizedShape(shape: number, axis: "x" | "z", orientation: "-" | "+"): number
{
    return VoxelBlockShapeUtil.moveBound(shape, axis, orientation,
        !VoxelBlockShapeUtil.isBoundInMidCell(shape, axis, orientation));
}

function isOnDraggedBlock(selection: VoxelQuadSelection | null): boolean
{
    return selection != null && selection.voxel.row == draggedBlock.row && selection.voxel.col == draggedBlock.col &&
        VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(selection.quadIndex) == draggedBlock.collisionLayer;
}

// ─── Drags ──────────────────────────────────────────────────────────────

// The bound follows the pointer across the face, offset by where on the handle the press took hold, and
// goes over to its other place once it is carried past halfway there.
function beginResize(selection: VoxelQuadSelection, pressEv: PointerEvent,
    handle: {id: string, axis: "x" | "z", orientation: "-" | "+"}): SelectionEditDrag
{
    const {axis, orientation} = handle;
    const quadIndex = selection.quadIndex;
    const cellStart = (axis == "x") ? selection.voxel.col : selection.voxel.row;
    const face = getFace(App.getCurrentRoom()!, selection);
    // (A bound across the face never moves the face's own plane.)
    const plane = SelectionEditGizmoUtil.getFacePlane(face.dir, face.center, new THREE.Plane());

    const bounds = VoxelBlockShapeUtil.getBounds(getBlockShape(selection));
    const boundAtPress = cellStart + ((axis == "x")
        ? ((orientation == "+") ? bounds.maxX : bounds.minX)
        : ((orientation == "+") ? bounds.maxZ : bounds.minZ));
    const grabOffset = SelectionEditGizmoUtil.getPointerOnPlane(pressEv, plane, hitTemp)
        ? ((axis == "x") ? hitTemp.x : hitTemp.z) - boundAtPress : 0;
    const halfway = (orientation == "+") ? 0.75 : 0.25;
    draggedBlock = {row: selection.voxel.row, col: selection.voxel.col,
        collisionLayer: VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex)};

    return {
        handleId: handle.id,
        onMove: (ev: PointerEvent) =>
        {
            const room = App.getCurrentRoom();
            if (!room || !ensurePreview(room, quadIndex) || !SelectionEditGizmoUtil.getPointerOnPlane(ev, plane, hitTemp))
                return;

            // Where across its cell the bound is asked to be, from 0 to 1.
            const asked = ((axis == "x") ? hitTemp.x : hitTemp.z) - grabOffset - cellStart;
            const shape = getBlockShape(selection);
            const inMidCell = VoxelBlockShapeUtil.isBoundInMidCell(shape, axis, orientation);
            const towardCellSide = (orientation == "+") ? asked > halfway + RESIZE_DEAD_BAND : asked < halfway - RESIZE_DEAD_BAND;
            const towardMidCell = (orientation == "+") ? asked < halfway - RESIZE_DEAD_BAND : asked > halfway + RESIZE_DEAD_BAND;
            if (inMidCell ? !towardCellSide : !towardMidCell)
                return;

            const resized = getResizedShape(shape, axis, orientation);
            if (resized != VOXEL_BLOCK_SHAPE_EMPTY)
                ClientVoxelManager.previewVoxelBlockShape(room, resized);
        },
        onFinish: finishDrag,
        onReleased: settleSelection,
    };
}

// Whether the block the drag began on is being previewed: begun on the drag's first move, since a press
// that never becomes a drag changes nothing.
function ensurePreview(room: Room, quadIndex: number): boolean
{
    return voxelBlockPreviewObservable.peek() || ClientVoxelManager.beginVoxelBlockPreview(room, quadIndex);
}

// keep: send the edit the drag came to; otherwise put the block back.
function finishDrag(keep: boolean): void
{
    const room = App.getCurrentRoom();
    if (!keep || room == undefined)
    {
        ClientVoxelManager.cancelVoxelBlockPreview();
        return;
    }

    const edit = ClientVoxelManager.commitVoxelBlockPreview(room);
    if (edit != null && room.roomType != RoomTypeEnumMap.SinglePlayer)
        SocketsClient.emitSetVoxelBlockShapeSignal(new SetVoxelBlockShapeSignal(room.id, edit.quadIndex, edit.shape));
}

// ─── The selection ──────────────────────────────────────────────────────

// Once a drag is over, unless the selection has moved on from the block: re-announced, so the outline, menu
// and view catch up, or moved to a face of the block that shows if its own no longer does.
function settleSelection(): void
{
    const room = App.getCurrentRoom();
    const selection = voxelQuadSelectionObservable.peek();
    if (!GameModeUtil.isInEditMode() || room == undefined || selection == null || !isOnDraggedBlock(selection))
        return;

    const voxels = room.voxelGrid.voxels;
    if (VoxelQueryUtil.isVoxelQuadVisible(voxels, selection.quadIndex))
    {
        voxelQuadSelectionObservable.notify();
        return;
    }
    const shown = FALLBACK_FACES
        .map(face => VoxelQueryUtil.getVoxelQuadIndex(draggedBlock.row, draggedBlock.col, face.facingAxis,
            face.orientation, draggedBlock.collisionLayer))
        .find(quadIndex => VoxelQueryUtil.isVoxelQuadVisible(voxels, quadIndex));
    if (shown != undefined)
    {
        voxelQuadSelectionObservable.set(new VoxelQuadSelection(selection.voxel, shown));
        return;
    }
    // (None of the block's faces shows: shut in on every side.)
    VoxelQuadSelection.unselect();
    VoxelQuadSelection.trySelectBestQuad(selection.voxel, selection.quadIndex);
}

// ─── Wiring ─────────────────────────────────────────────────────────────
// (A drag is ended on leaving edit mode or the room by SelectionEditGizmoUtil.)

function refresh(): void
{
    target = findTarget();
    if (target == null)
        SelectionEditGizmoUtil.abandonDrag("voxelQuad");
}

SelectionEditGizmoUtil.addProvider("voxelQuad", VoxelQuadEditGizmos);

voxelQuadSelectionObservable.addListener("voxelQuadEditGizmos", (selection: VoxelQuadSelection | null) => {
    // A drag belongs to the block it began on.
    if (SelectionEditGizmoUtil.isDragging("voxelQuad") && !isOnDraggedBlock(selection))
        SelectionEditGizmoUtil.abandonDrag("voxelQuad");
    refresh();
});

gameModeObservable.addListener("voxelQuadEditGizmos", refresh);

roomChangedObservable.addListener("voxelQuadEditGizmos", () => {
    target = null;
});

for (const flag of STAND_DOWN_FLAGS)
    clientFeatureFlagsObservable.addElementListener("voxelQuadEditGizmos", flag, refresh);
voxelQuadSelectionRestrictionObservable.addListener("voxelQuadEditGizmos", refresh);

// A preview ended from outside (another edit of the room's blocks came in) leaves a drag nothing to go on.
voxelBlockPreviewObservable.addListener("voxelQuadEditGizmos", (previewing: boolean) => {
    if (!previewing)
        SelectionEditGizmoUtil.abandonDrag("voxelQuad");
});

export default VoxelQuadEditGizmos;
