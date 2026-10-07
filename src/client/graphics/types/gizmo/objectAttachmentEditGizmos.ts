import * as THREE from "three";
import ObjectSelection from "./objectSelection";
import { gameModeObservable, objectSelectionObservable,
    roomChangedObservable } from "../../../system/clientObservables";
import GameModeUtil from "../../../system/util/gameModeUtil";
import WorldSpaceOutlineRect from "./generic/worldSpaceOutlineRect";
import SelectionEditDrag from "./drag/selectionEditDrag";
import SelectionEditGizmoProvider from "./drag/selectionEditGizmoProvider";
import SelectionEditGizmoUtil from "../../util/selectionEditGizmoUtil";
import CameraUtil from "../../util/cameraUtil";
import PointerCoordUtil from "../../util/pointerCoordUtil";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import ClientObjectManager from "../../../object/clientObjectManager";
import ClientVoxelQueryUtil from "../../../voxel/util/clientVoxelQueryUtil";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import ObjectTransform from "../../../../shared/object/types/objectTransform";
import SetObjectTransformSignal from "../../../../shared/object/types/setObjectTransformSignal";
import SetObjectMetadataSignal from "../../../../shared/object/types/setObjectMetadataSignal";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import QuarterTurnsUtil from "../../../../shared/object/util/quarterTurnsUtil";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import ObjectScaleUtil from "../../../../shared/object/util/objectScaleUtil";
import ObjectUpdateUtil from "../../../../shared/object/util/objectUpdateUtil";
import ObjectAttachmentUtil from "../../../../shared/object/util/objectAttachmentUtil";
import Geometry3DUtil from "../../../../shared/math/util/geometry3DUtil";
import Vector3DUtil from "../../../../shared/math/util/vector3DUtil";
import Room from "../../../../shared/room/types/room";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import Vec3 from "../../../../shared/math/types/vec3";

// Moving and resizing the selected attached object by its selection outline (see SelectionEditGizmoUtil):
// dragging inside it puts the object on whichever voxel face the pointer is over (see
// ObjectAttachmentUtil.findPlacement), and dragging a corner handle resizes it (types whose
// ObjectScalingConfig has them). Edits preview locally and reach the server once, on release.

// Which way each handle's corner lies from the middle, along the face's right and up (see
// Geometry3DUtil.getAxisFacingBasis).
const CORNERS: {x: number, y: number}[] = [{x: -1, y: -1}, {x: 1, y: -1}, {x: 1, y: 1}, {x: -1, y: 1}];

// How far from the object's face a pointer hit still counts as on that face.
const SAME_FACE_TOLERANCE = 0.01;

type EditTarget = {selection: ObjectSelection, canMove: boolean, canResize: boolean};

// The selection, when it is an attached object this user may drag (refreshed on every re-announcement).
let target: EditTarget | null = null;

// The object the drag under way began on; left as it was once that drag is over.
let draggedObjectId: string | null = null;

// The outline's corners, where the handles sit; placed whenever they are asked for.
const outlineCorners = CORNERS.map(corner => ({id: `${corner.x},${corner.y}`, corner, position: new THREE.Vector3()}));
const noHandles: {id: string, position: THREE.Vector3}[] = [];

const rayTemp = new THREE.Ray();
const planeTemp = new THREE.Plane();
const hitTemp = new THREE.Vector3();
const cornerTemp = new THREE.Vector3();
const middleScreenTemp = new THREE.Vector2();

const ObjectAttachmentEditGizmos: SelectionEditGizmoProvider =
{
    getHandles: () =>
    {
        if (target == null || !target.canResize)
            return noHandles;
        return placeOutlineCorners(target.selection);
    },

    pickHandle: (handleIndex: number, ev: PointerEvent, handleScreen: {x: number, y: number}) =>
    {
        const selection = target!.selection;
        const corner = CORNERS[handleIndex];
        // The cursor's arrow runs along the screen diagonal the handle sits on.
        const middle = PointerCoordUtil.worldToClient(selection.gameObject.position, middleScreenTemp);
        const rising = middle != null && ((handleScreen.x > middle.x) == (handleScreen.y < middle.y));
        return {cursor: rising ? "nesw-resize" : "nwse-resize",
            begin: () => beginResize(selection, ev, corner, outlineCorners[handleIndex].id)};
    },

    // The inside of the outline, measured on the plane of the object's face.
    pickBody: (ev: PointerEvent) =>
    {
        if (target == null || !target.canMove)
            return null;
        const selection = target.selection;
        const params = selection.gameObject.params;
        const size = ObjectScaleUtil.getObjectSize(params.objectTypeIndex, params.transform.scale);
        if (!SelectionEditGizmoUtil.isPointerOnFaceRect(ev, selection.gameObject.position, params.transform.dir,
            WorldSpaceOutlineRect.getEdgeOffset(size.x), WorldSpaceOutlineRect.getEdgeOffset(size.y)))
        {
            return null;
        }
        return {cursor: "move", begin: () => beginMove(selection, ev)};
    },

    getOutline: () =>
    {
        if (target == null || !target.canMove)
            return null;
        return {middle: target.selection.gameObject.position, corners: placeOutlineCorners(target.selection)};
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

    const config = ObjectTypeConfigMap.getConfigByIndex(selection.gameObject.params.objectTypeIndex);
    if (!config.attachment)
        return null;
    const obj = room.objectById[selection.gameObject.params.objectId];
    if (!obj)
        return null;

    // Asked of where it stands, so this comes down to whether this user may move it at all. One whose
    // metadata pins its scale (see ObjectScalingConfig.getFixedScale) isn't resized by hand.
    const canMove = canApply(room, obj.objectId, obj.transform);
    return {selection, canMove,
        canResize: canMove && config.scaling != undefined && config.scaling.cornerHandles !== false
            && ObjectScaleUtil.getFixedScale(obj.objectTypeIndex, obj.metadata) == undefined};
}

// ─── Drags ──────────────────────────────────────────────────────────────

// The object goes to the face under the pointer, keeping under it the spot it was taken hold of while it
// stays on the same face. Where the object can't go, it slides back toward where it stood along that face,
// or tries the spots around the pointer on another one.
function beginMove(selection: ObjectSelection, pressEv: PointerEvent): SelectionEditDrag
{
    const objectId = selection.gameObject.params.objectId;
    const start = copyTransform(selection.gameObject.params.transform);
    const startQuarterTurns = getTurnable(objectId) ? QuarterTurnsUtil.getQuarterTurns(selection.gameObject.params) : undefined;
    const grabOffset = getGrabOffset(start, pressEv);
    let lastRequest: string | null = null;
    draggedObjectId = objectId;

    return {
        onMove: (ev: PointerEvent) =>
        {
            const room = App.getCurrentRoom();
            const obj = room?.objectById[objectId];
            if (!room || !obj)
                return;

            const request = getMoveRequest(obj, ev, grabOffset);
            if (request == undefined)
                return;
            // Placement is searched for, so a pointer still over the same spot isn't asked about again.
            const requestKey = `${request.dir.x},${request.dir.y},${request.dir.z}:` +
                `${request.center.x.toFixed(2)},${request.center.y.toFixed(2)},${request.center.z.toFixed(2)}`;
            if (requestKey == lastRequest)
                return;
            lastRequest = requestKey;

            // From where the drag started, so the path taken doesn't matter. The whole object turns with its
            // content, so an odd change of turn swaps its footprint (as the rotate tool does).
            const quarterTurns = (startQuarterTurns == undefined) ? undefined : QuarterTurnsUtil.getMovedQuarterTurns(
                start, startQuarterTurns, {pos: request.center, dir: request.dir}, PointerCoordUtil.projectPoint);
            const turnedAcross = quarterTurns != undefined && Math.abs(quarterTurns - startQuarterTurns!) % 2 == 1;
            const scale = turnedAcross ? {x: start.scale.y, y: start.scale.x, z: start.scale.z} : start.scale;

            const placed = ObjectAttachmentUtil.findPlacement(room, obj.objectTypeIndex, request.center, request.dir,
                scale, (transform) => canApply(room, objectId, transform, quarterTurns),
                request.onSameFace ? obj.transform.pos : undefined);
            if (placed != undefined && !transformsMatch(placed, obj.transform))
            {
                apply(objectId, placed);
                if (quarterTurns != undefined)
                    applyQuarterTurns(objectId, quarterTurns);
            }
        },
        onFinish: (keep: boolean) => finishDrag(objectId, start, keep, startQuarterTurns),
        onReleased: () => reannounce(objectId),
    };
}

// The dragged corner follows the pointer, offset by where on the handle it took hold, and the opposite
// corner stays where it was (see ObjectAttachmentUtil.getResizeResult).
function beginResize(selection: ObjectSelection, pressEv: PointerEvent,
    corner: {x: number, y: number}, handleId: string): SelectionEditDrag
{
    const objectId = selection.gameObject.params.objectId;
    const start = copyTransform(selection.gameObject.params.transform);
    const plane = SelectionEditGizmoUtil.getFacePlane(start.dir, start.pos, new THREE.Plane());
    const grabOffset = new THREE.Vector3();
    if (SelectionEditGizmoUtil.getPointerOnPlane(pressEv, plane, grabOffset))
        grabOffset.sub(getObjectCorner(selection.gameObject.params.objectTypeIndex, start, corner, cornerTemp));
    else
        grabOffset.set(0, 0, 0);
    draggedObjectId = objectId;

    return {
        handleId,
        onMove: (ev: PointerEvent) =>
        {
            const room = App.getCurrentRoom();
            const obj = room?.objectById[objectId];
            if (!room || !obj)
                return;
            if (!SelectionEditGizmoUtil.getPointerOnPlane(ev, plane, hitTemp))
                return;

            hitTemp.sub(grabOffset);
            const resized = ObjectAttachmentUtil.getResizeResult(room, obj, start, corner.x, corner.y,
                {x: hitTemp.x, y: hitTemp.y, z: hitTemp.z});
            if (resized != undefined && !transformsMatch(resized, obj.transform) &&
                canApply(room, objectId, resized))
            {
                apply(objectId, resized);
            }
        },
        onFinish: (keep: boolean) => finishDrag(objectId, start, keep),
        onReleased: () => reannounce(objectId),
    };
}

// Where on the object the press took hold of it, along its face's right and up.
function getGrabOffset(transform: ObjectTransform, pressEv: PointerEvent): {x: number, y: number}
{
    const plane = SelectionEditGizmoUtil.getFacePlane(transform.dir, transform.pos, planeTemp);
    if (!SelectionEditGizmoUtil.getPointerOnPlane(pressEv, plane, hitTemp))
        return {x: 0, y: 0};
    const {right, up} = Geometry3DUtil.getAxisFacingBasis(transform.dir);
    const offset = Vector3DUtil.subtract(hitTemp, transform.pos);
    return {x: Vector3DUtil.dot(offset, right), y: Vector3DUtil.dot(offset, up)};
}

// Where the pointer asks the object to be centred, and facing which way. The face under it if the type
// may be attached there; otherwise the object's own face, where the pointer meets its plane. Undefined if
// the pointer is on neither.
function getMoveRequest(obj: AddObjectSignal, ev: PointerEvent, grabOffset: {x: number, y: number}):
    {center: Vec3, dir: Vec3, onSameFace: boolean} | undefined
{
    const current = Geometry3DUtil.getAxisFacingBasis(obj.transform.dir);
    CameraUtil.getPointerRay(ev, rayTemp);

    let point: Vec3 | undefined;
    let normal = current.normal;
    const face = ClientVoxelQueryUtil.getFirstDrawnFaceAlongRay(rayTemp);
    if (face != undefined && ObjectAttachmentUtil.allowsFacing(obj.objectTypeIndex, face.normal))
    {
        point = face.point;
        normal = face.normal;
    }
    else
    {
        const plane = SelectionEditGizmoUtil.getFacePlane(obj.transform.dir, obj.transform.pos, planeTemp);
        if (rayTemp.direction.dot(plane.normal) >= 0 || rayTemp.intersectPlane(plane, hitTemp) == null)
            return undefined;
        point = {x: hitTemp.x, y: hitTemp.y, z: hitTemp.z};
    }

    const onSameFace = Vector3DUtil.equal(normal, current.normal) &&
        Math.abs(Vector3DUtil.dot(Vector3DUtil.subtract(point, obj.transform.pos), normal)) < SAME_FACE_TOLERANCE;
    if (!onSameFace)
        return {center: point, dir: normal, onSameFace};

    // On the object's own face, the spot it was taken hold of stays under the pointer.
    const center = Vector3DUtil.subtract(point, Vector3DUtil.add(
        Vector3DUtil.scale(current.right, grabOffset.x), Vector3DUtil.scale(current.up, grabOffset.y)));
    return {center, dir: normal, onSameFace};
}

// Asked by the same rule the server applies (permissions, restricted zones, placement), so an edit that
// won't take is refused quietly rather than logged as a failure.
// With the turn the object will have there, when that differs from its own: asked as one edit, as release
// sends it, since a turn can change the scale the object is pinned to (see ObjectScalingConfig.getFixedScale).
function canApply(room: Room, objectId: string, transform: ObjectTransform, quarterTurns?: number): boolean
{
    const obj = room.objectById[objectId];
    if (obj && quarterTurns != undefined && QuarterTurnsUtil.getQuarterTurns(obj) != quarterTurns)
    {
        return ObjectUpdateUtil.canSetObjectMetadata(App.getUser(), room, new SetObjectMetadataSignal(room.id,
            objectId, ObjectMetadataKeyEnumMap.QuarterTurns, QuarterTurnsUtil.encode(quarterTurns), transform));
    }
    return ObjectUpdateUtil.canSetObjectTransform(App.getUser(), room,
        new SetObjectTransformSignal(room.id, objectId, transform, true));
}

// Previews an edit locally; the server hears of it on release (see finishDrag).
function apply(objectId: string, transform: ObjectTransform): void
{
    ClientObjectManager.setObjectTransform(objectId, transform, true, false);
}

// Whether a move carries the object's content turn along (see QuarterTurnsUtil.getMovedQuarterTurns): only
// for types this user may turn.
function getTurnable(objectId: string): boolean
{
    const room = App.getCurrentRoom();
    const obj = room?.objectById[objectId];
    if (!room || !obj)
        return false;
    return ObjectUpdateUtil.canSetObjectMetadata(App.getUser(), room, new SetObjectMetadataSignal(room.id,
        objectId, ObjectMetadataKeyEnumMap.QuarterTurns, QuarterTurnsUtil.encode(QuarterTurnsUtil.getQuarterTurns(obj))));
}

// Previews a turn locally, as apply does a transform.
function applyQuarterTurns(objectId: string, quarterTurns: number): void
{
    const obj = App.getCurrentRoom()?.objectById[objectId];
    if (obj && QuarterTurnsUtil.getQuarterTurns(obj) != quarterTurns)
    {
        ClientObjectManager.setObjectMetadata(objectId, ObjectMetadataKeyEnumMap.QuarterTurns,
            QuarterTurnsUtil.encode(quarterTurns), false);
    }
}

// keep: send the result; otherwise put the object back where it started, turned as it was.
function finishDrag(objectId: string, start: ObjectTransform, keep: boolean, startQuarterTurns?: number): void
{
    const room = App.getCurrentRoom();
    const obj = room?.objectById[objectId];
    if (!room || !obj)
        return;

    if (!keep)
    {
        ClientObjectManager.setObjectTransform(objectId, start, true, false);
        if (startQuarterTurns != undefined)
            applyQuarterTurns(objectId, startQuarterTurns);
    }
    else if (room.roomType != RoomTypeEnumMap.SinglePlayer)
    {
        // A move that turned the object is one edit, the turn carrying the transform (see
        // SetObjectMetadataSignal.transform).
        if (startQuarterTurns != undefined && QuarterTurnsUtil.getQuarterTurns(obj) != startQuarterTurns)
        {
            SocketsClient.emitSetObjectMetadataSignal(new SetObjectMetadataSignal(room.id, objectId,
                ObjectMetadataKeyEnumMap.QuarterTurns, QuarterTurnsUtil.encode(QuarterTurnsUtil.getQuarterTurns(obj)),
                copyTransform(obj.transform)));
        }
        else if (!transformsMatch(obj.transform, start))
        {
            SocketsClient.emitSetObjectTransformSignal(new SetObjectTransformSignal(
                room.id, objectId, copyTransform(obj.transform), true));
        }
    }
}

// Re-announced once a drag is over, so the outline, menu and permissions catch up, unless it ended because
// the selection moved on.
function reannounce(objectId: string): void
{
    if (GameModeUtil.isInEditMode() &&
        objectSelectionObservable.peek()?.gameObject.params.objectId === objectId)
    {
        objectSelectionObservable.notify();
    }
}

// ─── Geometry ───────────────────────────────────────────────────────────

// A corner of the object's own footprint.
function getObjectCorner(objectTypeIndex: number, transform: ObjectTransform,
    corner: {x: number, y: number}, out: THREE.Vector3): THREE.Vector3
{
    return offsetAlongFace(objectTypeIndex, transform, transform.pos, corner, (size) => 0.5 * size, out);
}

// Puts each corner of the selection outline where it now is, and returns them.
function placeOutlineCorners(selection: ObjectSelection): typeof outlineCorners
{
    const params = selection.gameObject.params;
    for (const outlineCorner of outlineCorners)
    {
        offsetAlongFace(params.objectTypeIndex, params.transform, selection.gameObject.position, outlineCorner.corner,
            WorldSpaceOutlineRect.getEdgeOffset, outlineCorner.position);
    }
    return outlineCorners;
}

// From center toward a corner, by reach(size) along the face's right and up, for the object's current size.
function offsetAlongFace(objectTypeIndex: number, transform: ObjectTransform, center: Vec3,
    corner: {x: number, y: number}, reach: (size: number) => number, out: THREE.Vector3): THREE.Vector3
{
    const size = ObjectScaleUtil.getObjectSize(objectTypeIndex, transform.scale);
    const {right, up} = Geometry3DUtil.getAxisFacingBasis(transform.dir);
    const alongRight = corner.x * reach(size.x);
    const alongUp = corner.y * reach(size.y);
    return out.set(center.x + right.x * alongRight + up.x * alongUp,
        center.y + right.y * alongRight + up.y * alongUp,
        center.z + right.z * alongRight + up.z * alongUp);
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

// ─── Wiring ─────────────────────────────────────────────────────────────
// (A drag is ended on leaving edit mode or the room by SelectionEditGizmoUtil.)

function refresh(): void
{
    target = findTarget();
}

SelectionEditGizmoUtil.addProvider("object", ObjectAttachmentEditGizmos);

objectSelectionObservable.addListener("objectAttachmentEditGizmos", (selection: ObjectSelection | null) => {
    // A drag belongs to the object it began on.
    if (SelectionEditGizmoUtil.isDragging("object") && selection?.gameObject.params.objectId !== draggedObjectId)
        SelectionEditGizmoUtil.abandonDrag("object");
    refresh();
});

gameModeObservable.addListener("objectAttachmentEditGizmos", refresh);

roomChangedObservable.addListener("objectAttachmentEditGizmos", () => {
    target = null;
});

export default ObjectAttachmentEditGizmos;
