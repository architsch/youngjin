import * as THREE from "three";
import ObjectSelection from "./objectSelection";
import SelectionEditDrag from "./drag/selectionEditDrag";
import SelectionEditGizmoProvider from "./drag/selectionEditGizmoProvider";
import GraphicsManager from "../../graphicsManager";
import SelectionEditGizmoUtil from "../../util/selectionEditGizmoUtil";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import ClientObjectManager from "../../../object/clientObjectManager";
import { gameModeObservable, objectSelectionObservable, roomChangedObservable } from "../../../system/clientObservables";
import { ClientEventType } from "../../../system/types/clientEventType";
import GameModeUtil from "../../../system/util/gameModeUtil";
import RoomEditUtil from "../../../system/util/roomEditUtil";
import Vec3 from "../../../../shared/math/types/vec3";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import ObjectTransform from "../../../../shared/object/types/objectTransform";
import VolumeObjectTypeConfig from "../../../../shared/object/types/objectTypeConfig/volumeObjectTypeConfig";
import SetObjectTransformSignal from "../../../../shared/object/types/setObjectTransformSignal";
import ObjectUpdateUtil from "../../../../shared/object/util/objectUpdateUtil";
import Room from "../../../../shared/room/types/room";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import { DIR_VEC_BY_NAME, VOXEL_CELL_SIZE } from "../../../../shared/system/sharedConstants";

// Resizing the selected volume by the corners of its outline (see SelectionEditGizmoUtil). The corner held follows
// the pointer across whichever side of the box at that corner faces the camera most squarely, and the corner across
// the box from it stays where it is: so one drag changes the box along two of its axes, and the third is changed
// from another side. A volume is never moved whole. Edits preview locally and reach the server once, on release.
// A drag is blocked while the corner can't be where the pointer asks.

type Axis = "x" | "y" | "z";
const AXES: Axis[] = ["x", "y", "z"];

// How far apart two coordinates still count as the same.
const TOLERANCE = 1e-6;

// The box's corners, where the handles sit: which way each lies from its middle along every axis. Placed
// whenever they are asked for.
const corners: {id: string, sign: Vec3, position: THREE.Vector3}[] = [];
for (const x of [-1, 1])
{
    for (const y of [-1, 1])
    {
        for (const z of [-1, 1])
            corners.push({id: `${x},${y},${z}`, sign: {x, y, z}, position: new THREE.Vector3()});
    }
}
const noHandles: typeof corners = [];

// The selection, when it is a volume this user may resize (refreshed on every re-announcement).
let target: ObjectSelection | null = null;

// The volume the drag under way began on.
let draggedObjectId: string | null = null;

const viewDirTemp = new THREE.Vector3();
const normalTemp = new THREE.Vector3();
const pointTemp = new THREE.Vector3();
const hitTemp = new THREE.Vector3();

const VolumeEditGizmos: SelectionEditGizmoProvider =
{
    // A volume can be as large as the room, which is then seen whole only from afar.
    handlesShowAtAnyDistance: true,

    getHandles: () =>
    {
        if (target == null)
            return noHandles;
        const box = VolumeObjectTypeConfig.util.getBox(target.gameObject.params.transform);
        for (const corner of corners)
        {
            const position = getCorner(box, corner.sign);
            corner.position.set(position.x, position.y, position.z);
        }
        return corners;
    },

    pickHandle: (handleIndex: number, ev: PointerEvent) =>
    {
        const selection = target!;
        const corner = corners[handleIndex];
        return {cursor: "move", begin: () => beginResize(selection, corner.sign, corner.id, ev)};
    },

    pickBody: () => null,

    // No face, so no corners across one: its handles say where it can be taken hold of.
    getOutline: () =>
    {
        return (target == null) ? null
            : {middle: target.gameObject.position, facing: DIR_VEC_BY_NAME["+y"], corners: []};
    },
}

// ─── What a press can take hold of ──────────────────────────────────────

function findTarget(): ObjectSelection | null
{
    if (!GameModeUtil.isInEditMode())
        return null;
    const room = App.getCurrentRoom();
    const selection = objectSelectionObservable.peek();
    if (!room || !selection)
        return null;

    const params = selection.gameObject.params;
    if (ObjectTypeConfigMap.getConfigByIndex(params.objectTypeIndex) != VolumeObjectTypeConfig)
        return null;
    const obj = room.objectById[params.objectId];
    // Asked of the box as it is, so this comes down to whether this user may resize it at all.
    return (obj && canApply(room, obj.objectId, obj.transform)) ? selection : null;
}

// ─── Drags ──────────────────────────────────────────────────────────────

function beginResize(selection: ObjectSelection, sign: Vec3, handleId: string, pressEv: PointerEvent): SelectionEditDrag
{
    const objectId = selection.gameObject.params.objectId;
    const start = copyTransform(selection.gameObject.params.transform);
    const box = VolumeObjectTypeConfig.util.getBox(start);
    const held = getCorner(box, sign);
    const across = getCorner(box, {x: -sign.x, y: -sign.y, z: -sign.z});

    // The side the corner moves across is settled as the drag begins, and holds for all of it.
    GraphicsManager.getCamera().getWorldDirection(viewDirTemp);
    const facedAxis = AXES.reduce((faced, axis) =>
        (Math.abs(viewDirTemp[axis]) > Math.abs(viewDirTemp[faced])) ? axis : faced);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        normalTemp.set(0, 0, 0).setComponent(AXES.indexOf(facedAxis), 1), pointTemp.set(held.x, held.y, held.z));

    // Where on the handle the press took hold, which stays under the pointer.
    const grabOffset = new THREE.Vector3();
    if (SelectionEditGizmoUtil.getPointerOnPlane(pressEv, plane, grabOffset))
        grabOffset.sub(pointTemp);
    else
        grabOffset.set(0, 0, 0);
    let reached = true;
    draggedObjectId = objectId;

    return {
        handleId,
        onMove: (ev: PointerEvent) =>
        {
            const room = App.getCurrentRoom();
            const obj = room?.objectById[objectId];
            if (!room || !obj)
                return reached;
            if (!SelectionEditGizmoUtil.getPointerOnPlane(ev, plane, hitTemp))
                return reached;

            hitTemp.sub(grabOffset);
            const asked: Vec3 = {x: hitTemp.x, y: hitTemp.y, z: hitTemp.z};
            asked[facedAxis] = held[facedAxis];

            // Never past the corner that stays: the box keeps a block's width along every axis.
            const corner: Vec3 = {...asked};
            for (const axis of AXES)
            {
                corner[axis] = (sign[axis] > 0) ? Math.max(asked[axis], across[axis] + VOXEL_CELL_SIZE)
                    : Math.min(asked[axis], across[axis] - VOXEL_CELL_SIZE);
            }
            const resized = VolumeObjectTypeConfig.util.makeTransform(across, corner);
            if (!transformsMatch(resized, obj.transform) && canApply(room, objectId, resized))
                ClientObjectManager.setObjectTransform(objectId, resized, true, false);

            // Short of where the pointer asks means held back: by the corner that stays, or the room's edge.
            const reachedCorner = getCorner(VolumeObjectTypeConfig.util.getBox(obj.transform), sign);
            reached = AXES.every(axis => Math.abs(reachedCorner[axis] - asked[axis]) <= 0.5 * VOXEL_CELL_SIZE + TOLERANCE);
            return reached;
        },
        onFinish: (keep: boolean) => finishDrag(objectId, start, keep),
        onReleased: () => reannounce(objectId),
    };
}

// Asked by the same rule the server applies, so an edit that won't take is refused quietly.
function canApply(room: Room, objectId: string, transform: ObjectTransform): boolean
{
    return ObjectUpdateUtil.canSetObjectTransform(App.getUser(), room,
        new SetObjectTransformSignal(room.id, objectId, transform, true));
}

// keep: send the result; otherwise put the box back as it was.
function finishDrag(objectId: string, start: ObjectTransform, keep: boolean): void
{
    const room = App.getCurrentRoom();
    const obj = room?.objectById[objectId];
    if (!room || !obj)
        return;

    if (!keep)
    {
        ClientObjectManager.setObjectTransform(objectId, start, true, false);
        return;
    }
    if (transformsMatch(obj.transform, start))
        return;

    const signal = new SetObjectTransformSignal(room.id, objectId, copyTransform(obj.transform), true);
    if (room.roomType != RoomTypeEnumMap.SinglePlayer)
        SocketsClient.emitSetObjectTransformSignal(signal);
    RoomEditUtil.record(ClientEventType.ManuallyChangedObjectTransform, room,
        {redo: [signal], undo: [new SetObjectTransformSignal(room.id, objectId, start, true)]});
}

// Re-announced once a drag is over, so the view and the tools catch up, unless it ended because the selection
// moved on.
function reannounce(objectId: string): void
{
    if (GameModeUtil.isInEditMode() &&
        objectSelectionObservable.peek()?.gameObject.params.objectId === objectId)
    {
        objectSelectionObservable.notify();
    }
}

// ─── Geometry ───────────────────────────────────────────────────────────

function getCorner(box: {min: Vec3, max: Vec3}, sign: Vec3): Vec3
{
    return {
        x: (sign.x > 0) ? box.max.x : box.min.x,
        y: (sign.y > 0) ? box.max.y : box.min.y,
        z: (sign.z > 0) ? box.max.z : box.min.z,
    };
}

function copyTransform(transform: ObjectTransform): ObjectTransform
{
    return new ObjectTransform({...transform.pos}, {...transform.dir}, {...transform.scale});
}

function transformsMatch(a: ObjectTransform, b: ObjectTransform): boolean
{
    return nearlyEqual(a.pos, b.pos) && nearlyEqual(a.scale, b.scale);
}

function nearlyEqual(a: Vec3, b: Vec3): boolean
{
    return Math.abs(a.x - b.x) < TOLERANCE && Math.abs(a.y - b.y) < TOLERANCE && Math.abs(a.z - b.z) < TOLERANCE;
}

// ─── Wiring ─────────────────────────────────────────────────────────────
// (A drag is ended on leaving edit mode or the room by SelectionEditGizmoUtil.)

function refresh(): void
{
    target = findTarget();
}

SelectionEditGizmoUtil.addProvider("object", VolumeEditGizmos);

objectSelectionObservable.addListener("volumeEditGizmos", (selection: ObjectSelection | null) => {
    // A drag belongs to the volume it began on.
    if (SelectionEditGizmoUtil.isDragging(VolumeEditGizmos) && selection?.gameObject.params.objectId !== draggedObjectId)
        SelectionEditGizmoUtil.abandonDrag(VolumeEditGizmos);
    refresh();
});

gameModeObservable.addListener("volumeEditGizmos", refresh);

roomChangedObservable.addListener("volumeEditGizmos", () => {
    target = null;
});

export default VolumeEditGizmos;
