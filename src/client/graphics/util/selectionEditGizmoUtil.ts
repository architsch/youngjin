import * as THREE from "three";
import GraphicsManager from "../graphicsManager";
import WorldSpaceHandle from "../types/gizmo/generic/worldSpaceHandle";
import GizmoDragHandler from "../types/gizmo/drag/gizmoDragHandler";
import SelectionEditDrag from "../types/gizmo/drag/selectionEditDrag";
import SelectionEditGizmoProvider from "../types/gizmo/drag/selectionEditGizmoProvider";
import SelectionKind from "../types/gizmo/selectionKind";
import GizmoDragUtil from "./gizmoDragUtil";
import CameraUtil from "./cameraUtil";
import PointerCoordUtil from "./pointerCoordUtil";
import WorldSpaceSelectionUtil from "./worldSpaceSelectionUtil";
import GameModeUtil from "../../system/util/gameModeUtil";
import { bottomUIHeightObservable, gameModeObservable, roomChangedObservable, selectionEditBlockedObservable,
    updateObservable } from "../../system/clientObservables";
import { SELECTION_BLOCKED_COLOR, SELECTION_HANDLE_MAX_DISTANCE } from "../../system/clientConstants";
import ClientVoxelQueryUtil from "../../voxel/util/clientVoxelQueryUtil";
import Geometry3DUtil from "../../../shared/math/util/geometry3DUtil";
import Vector3DUtil from "../../../shared/math/util/vector3DUtil";
import NumUtil from "../../../shared/math/util/numUtil";
import Vec3 from "../../../shared/math/types/vec3";
import ErrorUtil from "../../../shared/system/util/errorUtil";

// Editing the selection by its outline: handles on it resize the selection, and dragging its body moves
// it. Which of the two a kind of selection offers, and what a drag does, belongs to that kind (see
// SelectionEditGizmoProvider). What the kinds share is here: the handles themselves, which of them a press
// takes hold of, and a drag's upkeep. The view holds still while a drag lasts (see
// WorldSpaceSelectionUtil.holdOrbitTarget), but for following the pointer that moves a selection to its edge
// (see followDraggedSelection), and no drag outlives edit mode or the room. While a drag asks for what the
// selection can't do, it is announced as blocked (see selectionEditBlockedObservable).

const HANDLE_COLOR = "#ffff00";
const HANDLE_DIAMETER_PX = 18; // on screen, at any distance

// How close to a handle's middle a press takes hold of it, in CSS px; wider for a finger. Keep them at
// least half of HANDLE_DIAMETER_PX, or pressing the handle's edge won't grab it.
const MOUSE_HANDLE_REACH_PX = 14;
const TOUCH_HANDLE_REACH_PX = 28;

// The pointer that moves a selection has the view follow it within a margin of the view's edge (see
// followDraggedSelection): FOLLOW_SIDE_MARGIN_SHARE of the view's width from a side edge, FOLLOW_MARGIN_SHARE of
// its shorter side from the top or bottom one. At the edge the view goes FOLLOW_SPEED of its own distance from
// what it looks at each second, and turns FOLLOW_TURN_SPEED radians a second after a selection that has turned,
// until it sees that selection's face within FOLLOW_FACING_ANGLE of head-on; nearer the margin's inner side, more
// slowly.
const FOLLOW_SIDE_MARGIN_SHARE = 0.2;
const FOLLOW_MARGIN_SHARE = 0.15;
const FOLLOW_SPEED = 0.6;
const FOLLOW_TURN_SPEED = 1;
const FOLLOW_FACING_ANGLE = 0.25 * Math.PI;

const providers: {kind: SelectionKind, provider: SelectionEditGizmoProvider}[] = [];

// Lent each frame to whichever selection has handles to show, and made as more are wanted than there are.
const handles: WorldSpaceHandle[] = [];
let numHandlesBeingMade = 0;
let handlesFailed = false;

// lastMove: the pointer as the drag was last handed it; null until the press has become a drag. startFacing: the
// way the selection faced as it became one. turned: whether it has faced another way since.
let activeDrag: {provider: SelectionEditGizmoProvider, drag: SelectionEditDrag, lastMove: PointerEvent | null,
    startFacing: Vec3 | null, turned: boolean} | null = null;

// Where the camera stood when the drag was last handed the pointer.
const cameraAtLastMove = new THREE.Matrix4();

const heldHandleTemp: {id: string, position: THREE.Vector3}[] = [];
const reachTemp = {sideways: 0, upDown: 0};
const rayTemp = new THREE.Ray();
const planeTemp = new THREE.Plane();
const hitTemp = new THREE.Vector3();
const normalTemp = new THREE.Vector3();
const pointTemp = new THREE.Vector3();
const axisTemp = new THREE.Vector3();
const cameraPosTemp = new THREE.Vector3();
const screenTemp = new THREE.Vector2();

const SelectionEditGizmoUtil =
{
    // A kind may have several, each for selections of its own sort (e.g. attached objects, volumes), of which no
    // more than one has anything to offer at a time.
    addProvider: (kind: SelectionKind, provider: SelectionEditGizmoProvider): void =>
    {
        if (providers.some(entry => entry.provider == provider))
            throw new Error(`Selection edit gizmo provider already exists (kind = ${kind})`);
        providers.push({kind, provider});
    },

    // Whether the drag under way is one this provider began.
    isDragging: (provider: SelectionEditGizmoProvider): boolean => activeDrag?.provider == provider,

    // The handle this provider's drag holds, if one is under way and holds one.
    getHeldHandleId: (provider: SelectionEditGizmoProvider): string | undefined =>
        (activeDrag?.provider == provider) ? activeDrag.drag.handleId : undefined,

    // Ends this provider's drag, if one is under way, putting back whatever it changed.
    abandonDrag: (provider: SelectionEditGizmoProvider): void =>
    {
        if (activeDrag?.provider == provider)
            GizmoDragUtil.cancel();
    },

    // The plane a face lies in, through the given point. The facing is snapped onto its axis, as a stored
    // one decodes a little off it.
    getFacePlane: (dir: Vec3, point: Vec3, out: THREE.Plane): THREE.Plane =>
    {
        const {normal} = Geometry3DUtil.getAxisFacingBasis(dir);
        normalTemp.set(normal.x, normal.y, normal.z);
        return out.setFromNormalAndCoplanarPoint(normalTemp, pointTemp.set(point.x, point.y, point.z));
    },

    // Where the pointer meets a plane, from either side of it; false if it runs alongside.
    getPointerOnPlane: (ev: PointerEvent, plane: THREE.Plane, out: THREE.Vector3): boolean =>
    {
        CameraUtil.getPointerRay(ev, rayTemp);
        return rayTemp.intersectPlane(plane, out) != null;
    },

    // Whether the pointer is over a rectangle lying in the world, seen from its front: centred on a point,
    // facing a direction, and reaching the given distances along that face's right and up (see
    // Geometry3DUtil.getAxisFacingBasis).
    isPointerOnFaceRect: (ev: PointerEvent, center: Vec3, dir: Vec3, reachRight: number, reachUp: number): boolean =>
    {
        const plane = SelectionEditGizmoUtil.getFacePlane(dir, center, planeTemp);
        CameraUtil.getPointerRay(ev, rayTemp);
        if (rayTemp.direction.dot(plane.normal) >= 0 || rayTemp.intersectPlane(plane, hitTemp) == null)
            return false;

        const {right, up} = Geometry3DUtil.getAxisFacingBasis(dir);
        hitTemp.sub(pointTemp.set(center.x, center.y, center.z));
        return Math.abs(hitTemp.dot(axisTemp.set(right.x, right.y, right.z))) <= reachRight &&
            Math.abs(hitTemp.dot(axisTemp.set(up.x, up.y, up.z))) <= reachUp;
    },

    // Where the selection's outline shows, in the viewport coordinates a real drag starts from: its middle
    // (which a kind that can be moved is dragged by), its corners, and its handles (which resize it, when
    // it has any). Null when the selection is nothing this user may drag. For automation, which drives
    // drags as the player would.
    getGrabPoints: (): {kind: SelectionKind, middle: {x: number, y: number} | null,
        corners: {corner: {x: number, y: number}, x: number, y: number}[],
        handles: {id: string, x: number, y: number}[], canResize: boolean} | null =>
    {
        for (const {kind, provider} of providers)
        {
            const outline = provider.getOutline();
            if (outline == null)
                continue;

            const middle = PointerCoordUtil.worldToClient(outline.middle, screenTemp);
            const middlePoint = middle == null ? null : {x: middle.x, y: middle.y};
            const corners: {corner: {x: number, y: number}, x: number, y: number}[] = [];
            for (const {corner, position} of outline.corners)
            {
                const screen = PointerCoordUtil.worldToClient(position, screenTemp);
                if (screen != null)
                    corners.push({corner: {...corner}, x: screen.x, y: screen.y});
            }
            const shownHandles = getOfferedHandles(provider);
            const handlePoints: {id: string, x: number, y: number}[] = [];
            for (const {id, position} of shownHandles)
            {
                const screen = PointerCoordUtil.worldToClient(position, screenTemp);
                if (screen != null)
                    handlePoints.push({id, x: screen.x, y: screen.y});
            }
            return {kind, middle: middlePoint, corners, handles: handlePoints, canResize: shownHandles.length > 0};
        }
        return null;
    },
}

// ─── What a press can take hold of ──────────────────────────────────────

// The handles a provider's selection has now, in their order. Further from the camera than
// SELECTION_HANDLE_MAX_DISTANCE it has none, but for the one a drag holds, which never goes from under it.
function getOfferedHandles(provider: SelectionEditGizmoProvider): {id: string, position: THREE.Vector3}[]
{
    const all = provider.getHandles();
    const outline = (all.length > 0 && !provider.handlesShowAtAnyDistance) ? provider.getOutline() : null;
    if (outline == null ||
        outline.middle.distanceTo(GraphicsManager.getCamera().getWorldPosition(cameraPosTemp)) <= SELECTION_HANDLE_MAX_DISTANCE)
    {
        return all;
    }

    heldHandleTemp.length = 0;
    const held = (activeDrag?.provider == provider)
        ? all.find(handle => handle.id === activeDrag!.drag.handleId) : undefined;
    if (held != undefined)
        heldHandleTemp.push(held);
    return heldHandleTemp;
}

function pick(ev: PointerEvent): {cursor: string, begin: () => GizmoDragHandler} | null
{
    const reachPx = (ev.pointerType === "mouse") ? MOUSE_HANDLE_REACH_PX : TOUCH_HANDLE_REACH_PX;
    for (const {provider} of providers)
    {
        // Handles first: they sit on the outline, overlapping its inside. (No drag holds one as a press
        // lands, so they are all of the provider's or none.)
        const shownHandles = getOfferedHandles(provider);
        let nearest: {index: number, distSq: number, x: number, y: number} | null = null;
        for (let index = 0; index < shownHandles.length; ++index)
        {
            const screen = PointerCoordUtil.worldToClient(shownHandles[index].position, screenTemp);
            if (screen == null)
                continue;
            const distSq = (screen.x - ev.clientX) ** 2 + (screen.y - ev.clientY) ** 2;
            if (distSq <= reachPx * reachPx && (nearest == null || distSq < nearest.distSq))
                nearest = {index, distSq, x: screen.x, y: screen.y};
        }

        const picked = (nearest != null) ? provider.pickHandle(nearest.index, ev, {x: nearest.x, y: nearest.y})
            : provider.pickBody(ev);
        if (picked != null)
            return {cursor: picked.cursor, begin: () => runDrag(provider, picked.begin())};
    }
    return null;
}

// ─── Drags ──────────────────────────────────────────────────────────────

// A provider's drag, as GizmoDragUtil feeds it the pointer. Only a drag that got past the tap tolerance ever
// changed anything, so only such a one is finished.
function runDrag(provider: SelectionEditGizmoProvider, drag: SelectionEditDrag): GizmoDragHandler
{
    const state: NonNullable<typeof activeDrag> = {provider, drag, lastMove: null, startFacing: null, turned: false};
    activeDrag = state;

    const finish = (keep: boolean): void =>
    {
        activeDrag = null;
        setBlocked(false);
        if (state.lastMove == null)
            return;
        try
        {
            drag.onFinish(keep);
        }
        catch (err)
        {
            console.error(`Exception while finishing a drag of the selection :: Error: ${ErrorUtil.getErrorMessage(err)}`);
        }
        finally
        {
            WorldSpaceSelectionUtil.releaseOrbitTarget();
            drag.onReleased?.();
        }
    };

    return {
        onMove: (ev: PointerEvent) =>
        {
            if (state.lastMove == null)
            {
                WorldSpaceSelectionUtil.holdOrbitTarget();
                state.startFacing = provider.getOutline()?.facing ?? null;
            }
            handPointerToDrag(state, ev);
        },
        onEnd: () => finish(true),
        onCancel: () => finish(false),
    };
}

// Hands a drag the pointer, where it has moved to or where the view has since moved under it.
function handPointerToDrag(state: NonNullable<typeof activeDrag>, ev: PointerEvent): void
{
    state.lastMove = ev;
    cameraAtLastMove.copy(GraphicsManager.getCamera().matrixWorld);
    const blocked = !state.drag.onMove(ev);
    // (A move can end its own drag, e.g. by finding the selection gone.)
    if (activeDrag === state)
        setBlocked(blocked);
}

function abandonAnyDrag(): void
{
    if (activeDrag != null)
        GizmoDragUtil.cancel();
}

function setBlocked(blocked: boolean): void
{
    if (selectionEditBlockedObservable.peek() != blocked)
        selectionEditBlockedObservable.set(blocked);
}

// ─── The view following a moved selection ───────────────────────────────

// While the pointer that drags a selection by its body is in the view's margin, the orbit slides toward the place
// in the room it points at, whether or not the selection can go there, and turns to see a selection that has
// turned onto a face looking another way: both the faster the further into the margin the pointer is. The drag is
// handed the pointer again whenever the view has moved under it, which keeps the selection under the pointer.
function followDraggedSelection(deltaTime: number): void
{
    const state = activeDrag;
    if (state == null || state.lastMove == null || state.drag.handleId != undefined)
        return;
    if (!GraphicsManager.getCamera().matrixWorld.equals(cameraAtLastMove))
        handPointerToDrag(state, state.lastMove);
    if (activeDrag !== state)
        return;

    const facing = state.provider.getOutline()?.facing;
    if (facing != undefined && state.startFacing != null && !Vector3DUtil.equal(facing, state.startFacing))
        state.turned = true;

    // The view goes only the way of the edge the pointer is at: across for a side one, up or down for the top or
    // bottom one. (What it points at is seldom level with the view's middle, though it shows level with it.)
    const {sideways, upDown} = getReachIntoViewMargin(state.lastMove);
    const reach = Math.max(sideways, upDown);
    const pointed = (reach > 0) ? ClientVoxelQueryUtil.getFirstDrawnFaceAlongRay(
        CameraUtil.getPointerRay(state.lastMove, rayTemp)) : undefined;
    if (pointed == undefined)
        return;
    WorldSpaceSelectionUtil.slideHeldOrbitTarget(pointed.point, FOLLOW_SPEED * reach * deltaTime,
        sideways / reach, upDown / reach);
    if (state.turned && facing != undefined)
        WorldSpaceSelectionUtil.turnHeldOrbitToward(facing, FOLLOW_FACING_ANGLE, FOLLOW_TURN_SPEED * reach * deltaTime);
}

// How far into the margin of the view the pointer is, at a side edge and at the top or bottom one: from 0 at the
// margin's inner side to 1 at the view's edge and beyond. The view is the canvas, less what the 2D UI stands over
// along its bottom.
function getReachIntoViewMargin(ev: PointerEvent): {sideways: number, upDown: number}
{
    const rect = GraphicsManager.getGameCanvas().getBoundingClientRect();
    const height = Math.max(0, rect.height - bottomUIHeightObservable.peek());
    const sideMargin = FOLLOW_SIDE_MARGIN_SHARE * rect.width;
    const margin = FOLLOW_MARGIN_SHARE * Math.min(rect.width, height);
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    // (No margin, no view: neither edge is followed to.)
    reachTemp.sideways = (margin <= 0) ? 0
        : NumUtil.clampInRange(Math.max(sideMargin - x, x - (rect.width - sideMargin)) / sideMargin, 0, 1);
    reachTemp.upDown = (margin <= 0) ? 0
        : NumUtil.clampInRange(Math.max(margin - y, y - (height - margin)) / margin, 0, 1);
    return reachTemp;
}

// ─── Handles ────────────────────────────────────────────────────────────

function ensureHandles(count: number): void
{
    // (Asked every frame, so a failure is not tried again.)
    while (!handlesFailed && handles.length + numHandlesBeingMade < count)
    {
        ++numHandlesBeingMade;
        WorldSpaceHandle.create(HANDLE_COLOR, HANDLE_DIAMETER_PX).then(handle => {
            handle.addToParent(GraphicsManager.getScene());
            handles.push(handle);
        }).catch(err => {
            handlesFailed = true;
            console.error(`Failed to make a selection handle :: Error: ${ErrorUtil.getErrorMessage(err)}`);
        }).finally(() => {
            --numHandlesBeingMade;
        });
    }
}

// ─── Wiring ─────────────────────────────────────────────────────────────

GizmoDragUtil.addSource("selectionEditGizmoUtil", {pick});

gameModeObservable.addListener("selectionEditGizmoUtil", () => {
    if (!GameModeUtil.isInEditMode())
        abandonAnyDrag();
});

roomChangedObservable.addListener("selectionEditGizmoUtil", abandonAnyDrag);

updateObservable.addListener("selectionEditGizmoUtil", (deltaTime: number) => {
    followDraggedSelection(deltaTime);

    const color = selectionEditBlockedObservable.peek() ? SELECTION_BLOCKED_COLOR : HANDLE_COLOR;
    let numShown = 0;
    for (const {provider} of providers)
    {
        const shownHandles = getOfferedHandles(provider);
        for (let index = 0; index < shownHandles.length; ++index, ++numShown)
        {
            const handle = handles[numShown];
            if (handle == undefined)
                continue; // still being made
            handle.setVisible(true);
            handle.setPosition(shownHandles[index].position);
            handle.setHighlighted(activeDrag?.provider == provider && activeDrag.drag.handleId === shownHandles[index].id);
            handle.setColor(color);
            handle.update();
        }
    }
    ensureHandles(numShown);
    for (let i = numShown; i < handles.length; ++i)
        handles[i].setVisible(false);
});

export default SelectionEditGizmoUtil;
