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
import { gameModeObservable, roomChangedObservable, updateObservable } from "../../system/clientObservables";
import Geometry3DUtil from "../../../shared/math/util/geometry3DUtil";
import Vec3 from "../../../shared/math/types/vec3";
import ErrorUtil from "../../../shared/system/util/errorUtil";

// Editing the selection by its outline: handles on it resize the selection, and dragging its body moves
// it. Which of the two a kind of selection offers, and what a drag does, belongs to that kind (see
// SelectionEditGizmoProvider). What the kinds share is here: the handles themselves, which of them a press
// takes hold of, and a drag's upkeep. The view holds still while a drag lasts (see
// WorldSpaceSelectionUtil.holdOrbitTarget), and no drag outlives edit mode or the room.

const HANDLE_COLOR = "#ffff00";
const HANDLE_DIAMETER_PX = 18; // on screen, at any distance

// How close to a handle's middle a press takes hold of it, in CSS px; wider for a finger. Keep them at
// least half of HANDLE_DIAMETER_PX, or pressing the handle's edge won't grab it.
const MOUSE_HANDLE_REACH_PX = 14;
const TOUCH_HANDLE_REACH_PX = 28;

const providers: {kind: SelectionKind, provider: SelectionEditGizmoProvider}[] = [];

// Lent each frame to whichever selection has handles to show, and made as more are wanted than there are.
const handles: WorldSpaceHandle[] = [];
let numHandlesBeingMade = 0;
let handlesFailed = false;

let activeDrag: {kind: SelectionKind, drag: SelectionEditDrag} | null = null;

const rayTemp = new THREE.Ray();
const planeTemp = new THREE.Plane();
const hitTemp = new THREE.Vector3();
const normalTemp = new THREE.Vector3();
const pointTemp = new THREE.Vector3();
const axisTemp = new THREE.Vector3();
const screenTemp = new THREE.Vector2();

const SelectionEditGizmoUtil =
{
    addProvider: (kind: SelectionKind, provider: SelectionEditGizmoProvider): void =>
    {
        if (providers.some(entry => entry.kind == kind))
            throw new Error(`Selection edit gizmo provider already exists (kind = ${kind})`);
        providers.push({kind, provider});
    },

    isDragging: (kind: SelectionKind): boolean => activeDrag?.kind == kind,

    // Ends the drag of this kind's selection, if one is under way, putting back whatever it changed.
    abandonDrag: (kind: SelectionKind): void =>
    {
        if (activeDrag?.kind == kind)
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
            const shownHandles = provider.getHandles();
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

function pick(ev: PointerEvent): {cursor: string, begin: () => GizmoDragHandler} | null
{
    const reachPx = (ev.pointerType === "mouse") ? MOUSE_HANDLE_REACH_PX : TOUCH_HANDLE_REACH_PX;
    for (const {kind, provider} of providers)
    {
        // Handles first: they sit on the outline, overlapping its inside.
        const shownHandles = provider.getHandles();
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
            return {cursor: picked.cursor, begin: () => runDrag(kind, picked.begin())};
    }
    return null;
}

// ─── Drags ──────────────────────────────────────────────────────────────

// A kind's drag, as GizmoDragUtil feeds it the pointer. Only a drag that got past the tap tolerance ever
// changed anything, so only such a one is finished.
function runDrag(kind: SelectionKind, drag: SelectionEditDrag): GizmoDragHandler
{
    let started = false;
    activeDrag = {kind, drag};

    const finish = (keep: boolean): void =>
    {
        activeDrag = null;
        if (!started)
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
            if (!started)
            {
                started = true;
                WorldSpaceSelectionUtil.holdOrbitTarget();
            }
            drag.onMove(ev);
        },
        onEnd: () => finish(true),
        onCancel: () => finish(false),
    };
}

function abandonAnyDrag(): void
{
    if (activeDrag != null)
        GizmoDragUtil.cancel();
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

updateObservable.addListener("selectionEditGizmoUtil", () => {
    let numShown = 0;
    for (const {kind, provider} of providers)
    {
        const shownHandles = provider.getHandles();
        for (let index = 0; index < shownHandles.length; ++index, ++numShown)
        {
            const handle = handles[numShown];
            if (handle == undefined)
                continue; // still being made
            handle.setVisible(true);
            handle.setPosition(shownHandles[index].position);
            handle.setHighlighted(activeDrag?.kind == kind && activeDrag.drag.handleId === shownHandles[index].id);
            handle.update();
        }
    }
    ensureHandles(numShown);
    for (let i = numShown; i < handles.length; ++i)
        handles[i].setVisible(false);
});

export default SelectionEditGizmoUtil;
