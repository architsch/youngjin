import * as THREE from "three";
import ObjectSelection from "./objectSelection";
import { gameModeObservable, objectSelectionObservable, roomChangedObservable,
    updateObservable } from "../../../system/clientObservables";
import GameModeUtil from "../../../system/util/gameModeUtil";
import GraphicsManager from "../../graphicsManager";
import WorldSpaceHandle from "./generic/worldSpaceHandle";
import WorldSpaceOutlineRect from "./generic/worldSpaceOutlineRect";
import GizmoDragHandler from "./drag/gizmoDragHandler";
import GizmoDragUtil from "../../util/gizmoDragUtil";
import CameraUtil from "../../util/cameraUtil";
import PointerCoordUtil from "../../util/pointerCoordUtil";
import WorldSpaceSelectionUtil from "../../util/worldSpaceSelectionUtil";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import ClientObjectManager from "../../../object/clientObjectManager";
import ObjectTypeClientConfigMap from "../../../object/maps/objectTypeClientConfigMap";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import ObjectTransform from "../../../../shared/object/types/objectTransform";
import SetObjectTransformSignal from "../../../../shared/object/types/setObjectTransformSignal";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import ObjectScaleUtil from "../../../../shared/object/util/objectScaleUtil";
import ObjectUpdateUtil from "../../../../shared/object/util/objectUpdateUtil";
import WallAttachedObjectUtil from "../../../../shared/object/util/wallAttachedObjectUtil";
import Room from "../../../../shared/room/types/room";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import Vec3 from "../../../../shared/math/types/vec3";
import ErrorUtil from "../../../../shared/system/util/errorUtil";

// Moving and resizing the selected wall attachment by its selection outline: dragging inside it moves the
// object along its wall, in the steps and corner wraps of WallAttachedObjectUtil.getMoveResult, and
// dragging a corner handle resizes it (types with an ObjectScalingConfig). A type opts in through
// ObjectTypeClientConfig. The view holds still while a drag lasts (see
// WorldSpaceSelectionUtil.holdOrbitTarget); edits preview locally and reach the server once, on release.

const HANDLE_COLOR = "#ffff00";
const HANDLE_DIAMETER_PX = 18; // on screen, at any distance

// Along-wall and vertical distance of one move (see WallAttachedObjectUtil.getMoveResult).
const MOVE_STEP = 0.5;

// How close to a handle's middle a press takes hold of it, in CSS px; wider for a finger. Keep them at
// least half of HANDLE_DIAMETER_PX, or pressing the handle's edge won't grab it.
const MOUSE_HANDLE_REACH_PX = 14;
const TOUCH_HANDLE_REACH_PX = 28;

// Which way each handle's corner lies from the middle: along the wall (see
// WallAttachedObjectUtil.getRightDir) and up.
const CORNERS: {x: number, y: number}[] = [{x: -1, y: -1}, {x: 1, y: -1}, {x: 1, y: 1}, {x: -1, y: 1}];

type EditTarget = {selection: ObjectSelection, canMove: boolean, canResize: boolean};

// The selection, when it is a wall attachment this user may drag (refreshed on every re-announcement).
let target: EditTarget | null = null;

let handles: WorldSpaceHandle[] = [];
let handlesPromise: Promise<void> | null = null;

let draggingObjectId: string | null = null;
let draggedCorner: {x: number, y: number} | null = null;

const rayTemp = new THREE.Ray();
const planeTemp = new THREE.Plane();
const hitTemp = new THREE.Vector3();
const nextAnchorTemp = new THREE.Vector3();
const cornerTemp = new THREE.Vector3();
const normalTemp = new THREE.Vector3();
const pointTemp = new THREE.Vector3();
const screenTemp = new THREE.Vector2();
const middleScreenTemp = new THREE.Vector2();

const WallAttachmentEditGizmos =
{
    // Where the selection can be taken hold of, in the viewport coordinates a real drag starts from: its
    // middle (to move it) and the outline's corners (to resize it, when canResize). Null when there is
    // nothing this user may drag. For automation, which drives drags as the player would.
    getGrabPoints: (): {middle: {x: number, y: number} | null,
        corners: {corner: {x: number, y: number}, x: number, y: number}[], canResize: boolean} | null =>
    {
        if (target == null || !target.canMove)
            return null;
        const selection = target.selection;

        const middle = PointerCoordUtil.worldToClient(selection.gameObject.position, screenTemp);
        const corners: {corner: {x: number, y: number}, x: number, y: number}[] = [];
        const middlePoint = middle == null ? null : {x: middle.x, y: middle.y};
        for (const corner of CORNERS)
        {
            const screen = PointerCoordUtil.worldToClient(getHandlePosition(selection, corner, cornerTemp),
                screenTemp);
            if (screen != null)
                corners.push({corner: {...corner}, x: screen.x, y: screen.y});
        }
        return {middle: middlePoint, corners, canResize: target.canResize};
    },
}

// ─── What a press can take hold of ──────────────────────────────────────

function findTarget(): EditTarget | null
{
    if (!GameModeUtil.isInEditMode())
        return null;
    const room = App.getCurrentRoom();
    const selection = objectSelectionObservable.peek();
    if (!room || !selection)
        return null;

    const objectTypeIndex = selection.gameObject.params.objectTypeIndex;
    if (!ObjectTypeClientConfigMap.getConfigByIndex(objectTypeIndex).selection?.showMoveGizmos)
        return null;
    const config = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex);
    if (config.components.spawnedByAny?.collider?.colliderType != "wallAttachment")
        return null;
    const obj = room.objectById[selection.gameObject.params.objectId];
    if (!obj)
        return null;

    // Asked of where it stands, so this comes down to whether this user may move it at all.
    const canMove = ObjectUpdateUtil.canSetObjectTransform(App.getUser(), room,
        new SetObjectTransformSignal(room.id, obj.objectId, obj.transform, true));
    return {selection, canMove, canResize: canMove && config.scaling != undefined};
}

function pick(ev: PointerEvent): {cursor: string, begin: () => GizmoDragHandler} | null
{
    const current = target;
    if (current == null || !current.canMove)
        return null;
    const selection = current.selection;

    // Handles first: they sit on the outline's corners, overlapping the inside.
    if (current.canResize)
    {
        const reachPx = (ev.pointerType === "mouse") ? MOUSE_HANDLE_REACH_PX : TOUCH_HANDLE_REACH_PX;
        let nearest: {corner: {x: number, y: number}, distSq: number, x: number, y: number} | null = null;
        for (const corner of CORNERS)
        {
            const screen = PointerCoordUtil.worldToClient(getHandlePosition(selection, corner, cornerTemp),
                screenTemp);
            if (screen == null)
                continue;
            const distSq = (screen.x - ev.clientX) ** 2 + (screen.y - ev.clientY) ** 2;
            if (distSq <= reachPx * reachPx && (nearest == null || distSq < nearest.distSq))
                nearest = {corner, distSq, x: screen.x, y: screen.y};
        }
        if (nearest != null)
        {
            // The cursor's arrow runs along the screen diagonal the handle sits on.
            const middle = PointerCoordUtil.worldToClient(selection.gameObject.position, middleScreenTemp);
            const rising = middle != null && ((nearest.x > middle.x) == (nearest.y < middle.y));
            const corner = nearest.corner;
            return {cursor: rising ? "nesw-resize" : "nwse-resize",
                begin: () => beginResize(selection, ev, corner)};
        }
    }

    // The inside of the outline, measured on the plane of the object's face.
    const params = selection.gameObject.params;
    const plane = getFacePlane(params.transform, selection.gameObject.position, planeTemp);
    CameraUtil.getPointerRay(ev, rayTemp);
    if (rayTemp.direction.dot(plane.normal) >= 0 || rayTemp.intersectPlane(plane, hitTemp) == null)
        return null;
    const size = ObjectScaleUtil.getObjectSize(params.objectTypeIndex, params.transform.scale);
    const right = WallAttachedObjectUtil.getRightDir(params.transform.dir);
    hitTemp.sub(selection.gameObject.position);
    if (Math.abs(hitTemp.x * right.x + hitTemp.z * right.z) > WorldSpaceOutlineRect.getEdgeOffset(size.x) ||
        Math.abs(hitTemp.y) > WorldSpaceOutlineRect.getEdgeOffset(size.y))
    {
        return null;
    }
    return {cursor: "move", begin: () => beginMove(selection, ev)};
}

// ─── Drags ──────────────────────────────────────────────────────────────

// Travel is measured on the plane of the wall the object hangs on, and every step goes through
// getMoveResult, so a drag goes exactly where stepping would (round corners included).
function beginMove(selection: ObjectSelection, pressEv: PointerEvent): GizmoDragHandler
{
    const objectId = selection.gameObject.params.objectId;
    const start = copyTransform(selection.gameObject.params.transform);
    const plane = getFacePlane(start, start.pos, new THREE.Plane());
    const anchor = new THREE.Vector3();
    hitPlane(pressEv, plane, anchor);
    const steps = {x: 0, y: 0};
    let started = false;
    draggingObjectId = objectId;

    return {
        onMove: (ev: PointerEvent) =>
        {
            const room = App.getCurrentRoom();
            const obj = room?.objectById[objectId];
            if (!room || !obj)
                return;
            if (!started)
            {
                started = true;
                WorldSpaceSelectionUtil.holdOrbitTarget();
            }
            if (!hitPlane(ev, plane, hitTemp))
                return;

            const right = WallAttachedObjectUtil.getRightDir(obj.transform.dir);
            hitTemp.sub(anchor);
            const wantX = Math.round((hitTemp.x * right.x + hitTemp.z * right.z) / MOVE_STEP);
            const wantY = Math.round(hitTemp.y / MOVE_STEP);

            while (steps.y != wantY)
            {
                const step = Math.sign(wantY - steps.y);
                if (!tryStep(room, obj, 0, step))
                    break;
                steps.y += step;
            }
            while (steps.x != wantX)
            {
                const step = Math.sign(wantX - steps.x);
                const rightBefore = WallAttachedObjectUtil.getRightDir(obj.transform.dir);
                if (!tryStep(room, obj, step, 0))
                    break;
                steps.x += step;

                // Round a corner it hangs on another wall, so travel is measured afresh on that one.
                const rightAfter = WallAttachedObjectUtil.getRightDir(obj.transform.dir);
                if (rightAfter.x != rightBefore.x || rightAfter.z != rightBefore.z)
                {
                    const nextPlane = getFacePlane(obj.transform, obj.transform.pos, new THREE.Plane());
                    if (hitPlane(ev, nextPlane, nextAnchorTemp))
                    {
                        plane.copy(nextPlane);
                        anchor.copy(nextAnchorTemp);
                        steps.x = 0;
                        steps.y = 0;
                    }
                    break;
                }
            }
        },
        onEnd: () => finishDrag(objectId, start, started, true),
        onCancel: () => finishDrag(objectId, start, started, false),
    };
}

// The dragged corner follows the pointer, offset by where on the handle it took hold, and the opposite
// corner stays where it was (see WallAttachedObjectUtil.getResizeResult).
function beginResize(selection: ObjectSelection, pressEv: PointerEvent,
    corner: {x: number, y: number}): GizmoDragHandler
{
    const objectId = selection.gameObject.params.objectId;
    const start = copyTransform(selection.gameObject.params.transform);
    const plane = getFacePlane(start, start.pos, new THREE.Plane());
    const grabOffset = new THREE.Vector3();
    if (hitPlane(pressEv, plane, grabOffset))
        grabOffset.sub(getObjectCorner(selection.gameObject.params.objectTypeIndex, start, corner, cornerTemp));
    else
        grabOffset.set(0, 0, 0);
    let started = false;
    draggingObjectId = objectId;
    draggedCorner = corner;

    return {
        onMove: (ev: PointerEvent) =>
        {
            const room = App.getCurrentRoom();
            const obj = room?.objectById[objectId];
            if (!room || !obj)
                return;
            if (!started)
            {
                started = true;
                WorldSpaceSelectionUtil.holdOrbitTarget();
            }
            if (!hitPlane(ev, plane, hitTemp))
                return;

            hitTemp.sub(grabOffset);
            const resized = WallAttachedObjectUtil.getResizeResult(room, obj, start, corner.x, corner.y,
                {x: hitTemp.x, y: hitTemp.y, z: hitTemp.z});
            if (resized != undefined && !transformsMatch(resized, obj.transform))
                tryApply(room, objectId, resized);
        },
        onEnd: () => finishDrag(objectId, start, started, true),
        onCancel: () => finishDrag(objectId, start, started, false),
    };
}

function tryStep(room: Room, obj: AddObjectSignal, dx: number, dy: number): boolean
{
    const result = WallAttachedObjectUtil.getMoveResult(room, obj, dx * MOVE_STEP, dy * MOVE_STEP, 0);
    return result != undefined &&
        tryApply(room, obj.objectId, new ObjectTransform(result.newPos, result.newDir, {...obj.transform.scale}));
}

// Previews an edit locally. Checked first by the same rule the server applies (permissions, restricted
// zones, placement), so a step that won't take is refused quietly rather than logged as a failure.
function tryApply(room: Room, objectId: string, transform: ObjectTransform): boolean
{
    if (!ObjectUpdateUtil.canSetObjectTransform(App.getUser(), room,
        new SetObjectTransformSignal(room.id, objectId, transform, true)))
    {
        return false;
    }
    ClientObjectManager.setObjectTransform(objectId, transform, true, false);
    return true;
}

// keep: send the result; otherwise put the object back where it started. Only a drag that got past the
// tap tolerance ever changed anything.
function finishDrag(objectId: string, start: ObjectTransform, started: boolean, keep: boolean): void
{
    draggingObjectId = null;
    draggedCorner = null;
    if (!started)
        return;

    try
    {
        const room = App.getCurrentRoom();
        const obj = room?.objectById[objectId];
        if (room && obj)
        {
            if (!keep)
                ClientObjectManager.setObjectTransform(objectId, start, true, false);
            else if (!transformsMatch(obj.transform, start) && room.roomType != RoomTypeEnumMap.SinglePlayer)
            {
                SocketsClient.emitSetObjectTransformSignal(new SetObjectTransformSignal(
                    room.id, objectId, copyTransform(obj.transform), true));
            }
        }
    }
    catch (err)
    {
        console.error(`Exception while finishing a wall attachment drag :: Error: ${ErrorUtil.getErrorMessage(err)}`);
    }
    finally
    {
        WorldSpaceSelectionUtil.releaseOrbitTarget();
        // Re-announced so the outline, menu and permissions catch up, unless the drag ended because the
        // selection moved on.
        if (GameModeUtil.isInEditMode() &&
            objectSelectionObservable.peek()?.gameObject.params.objectId === objectId)
        {
            objectSelectionObservable.notify();
        }
    }
}

// ─── Geometry ───────────────────────────────────────────────────────────

// The plane of the object's face, through the given point. The facing is rounded onto its axis, as a
// stored one decodes a little off it.
function getFacePlane(transform: ObjectTransform, point: Vec3, out: THREE.Plane): THREE.Plane
{
    normalTemp.set(Math.round(transform.dir.x), 0, Math.round(transform.dir.z));
    return out.setFromNormalAndCoplanarPoint(normalTemp, pointTemp.set(point.x, point.y, point.z));
}

function hitPlane(ev: PointerEvent, plane: THREE.Plane, out: THREE.Vector3): boolean
{
    CameraUtil.getPointerRay(ev, rayTemp);
    return rayTemp.intersectPlane(plane, out) != null;
}

// A corner of the object's own footprint.
function getObjectCorner(objectTypeIndex: number, transform: ObjectTransform,
    corner: {x: number, y: number}, out: THREE.Vector3): THREE.Vector3
{
    return offsetAlongFace(objectTypeIndex, transform, transform.pos, corner, (size) => 0.5 * size, out);
}

// A corner of the selection outline, which is where its handle sits.
function getHandlePosition(selection: ObjectSelection, corner: {x: number, y: number},
    out: THREE.Vector3): THREE.Vector3
{
    const params = selection.gameObject.params;
    return offsetAlongFace(params.objectTypeIndex, params.transform, selection.gameObject.position, corner,
        WorldSpaceOutlineRect.getEdgeOffset, out);
}

// From center toward a corner, by reach(size) along the wall and up, for the object's current size.
function offsetAlongFace(objectTypeIndex: number, transform: ObjectTransform, center: Vec3,
    corner: {x: number, y: number}, reach: (size: number) => number, out: THREE.Vector3): THREE.Vector3
{
    const size = ObjectScaleUtil.getObjectSize(objectTypeIndex, transform.scale);
    const right = WallAttachedObjectUtil.getRightDir(transform.dir);
    const along = corner.x * reach(size.x);
    return out.set(center.x + right.x * along, center.y + corner.y * reach(size.y),
        center.z + right.z * along);
}

function copyTransform(transform: ObjectTransform): ObjectTransform
{
    return new ObjectTransform({...transform.pos}, {...transform.dir}, {...transform.scale});
}

function transformsMatch(a: ObjectTransform, b: ObjectTransform): boolean
{
    return nearlyEqual(a.pos, b.pos) && nearlyEqual(a.dir, b.dir) && nearlyEqual(a.scale, b.scale);
}

function nearlyEqual(a: Vec3, b: Vec3): boolean
{
    return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.z - b.z) < 1e-6;
}

// ─── Handles ────────────────────────────────────────────────────────────

function ensureHandles(): Promise<void>
{
    handlesPromise ??= (async () => {
        const scene = GraphicsManager.getScene();
        for (let i = 0; i < CORNERS.length; ++i)
        {
            const handle = await WorldSpaceHandle.create(HANDLE_COLOR, HANDLE_DIAMETER_PX);
            handle.addToParent(scene);
            handles.push(handle);
        }
    })();
    return handlesPromise;
}

function refresh(): void
{
    target = findTarget();
    if (target?.canResize)
        void ensureHandles();
}

function abandonDrag(): void
{
    if (draggingObjectId != null)
        GizmoDragUtil.cancel();
}

// ─── Wiring ─────────────────────────────────────────────────────────────

GizmoDragUtil.addSource("wallAttachmentEditGizmos", {pick});

objectSelectionObservable.addListener("wallAttachmentEditGizmos", (selection: ObjectSelection | null) => {
    // A drag belongs to the object it began on.
    if (draggingObjectId != null && selection?.gameObject.params.objectId !== draggingObjectId)
        abandonDrag();
    refresh();
});

gameModeObservable.addListener("wallAttachmentEditGizmos", () => {
    if (!GameModeUtil.isInEditMode())
        abandonDrag();
    refresh();
});

roomChangedObservable.addListener("wallAttachmentEditGizmos", () => {
    abandonDrag();
    target = null;
});

updateObservable.addListener("wallAttachmentEditGizmos", () => {
    const shown = target != null && target.canResize ? target.selection : null;
    for (let i = 0; i < handles.length; ++i)
    {
        const handle = handles[i];
        handle.setVisible(shown != null);
        if (shown == null)
            continue;
        handle.setPosition(getHandlePosition(shown, CORNERS[i], cornerTemp));
        handle.setHighlighted(draggedCorner === CORNERS[i]);
        handle.update();
    }
});

export default WallAttachmentEditGizmos;
