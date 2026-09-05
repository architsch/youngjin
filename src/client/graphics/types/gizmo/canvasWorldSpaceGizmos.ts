import * as THREE from "three";
import ObjectSelection from "./objectSelection";
import { gameModeObservable, objectSelectionObservable, roomChangedObservable, updateObservable } from "../../../system/clientObservables";
import GameModeUtil from "../../../system/util/gameModeUtil";
import GraphicsManager from "../../graphicsManager";
import WorldSpaceArrow from "./generic/worldSpaceArrow";
import ObjectUpdateUtil from "../../../../shared/object/util/objectUpdateUtil";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import SetObjectTransformSignal from "../../../../shared/object/types/setObjectTransformSignal";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import WallAttachedObjectUtil from "../../../../shared/object/util/wallAttachedObjectUtil";
import ClientObjectManager from "../../../object/clientObjectManager";
import ErrorUtil from "../../../../shared/system/util/errorUtil";
import ObjectTransform from "../../../../shared/object/types/objectTransform";
import { DIRECTION_VECTORS } from "../../../system/clientConstants";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");

// Arrow definitions for canvas:
//   +x (local right), -x (local left), +y (up), -y (down)
// dx/dy/dz passed to moveObject (note: for wall-attached objects, dx is local x-axis)
const arrowDefs = [
    { dir: "+x", dx: 0.5, dy: 0, dz: 0 },  // local right
    { dir: "-x", dx: -0.5, dy: 0, dz: 0 },  // local left
    { dir: "+y", dx: 0, dy: 0.5, dz: 0 },   // up
    { dir: "-y", dx: 0, dy: -0.5, dz: 0 },  // down
];

// Canvas is a 1x1 square. Arrows are placed at the edges.
const EDGE_OFFSET = 0.6; // slightly beyond the edge of the 0.5-unit half-size square

let arrows: WorldSpaceArrow[] = [];
let initialized = false;

const vec3Dir = new THREE.Vector3();
const vec3Right = new THREE.Vector3();
const vec3LocalDir = new THREE.Vector3();

async function ensureInitialized()
{
    if (initialized) return;
    initialized = true;

    const scene = GraphicsManager.getScene();

    for (const def of arrowDefs)
    {
        const arrow = await WorldSpaceArrow.create(def.dir, "#ffff00", 2);
        arrow.addToParent(scene);
        arrow.setVisible(false);
        arrows.push(arrow);
    }
}

function hideAll()
{
    for (const arrow of arrows)
        arrow.setVisible(false);
}

// The canvas the arrows are currently to be put up around, if any. Moving a canvas is an edit, so
// the arrows belong to edit mode alone: a click on a canvas during play mode is a way of looking at
// it and nothing more, and the tools for changing what was clicked stay away (see GameModeUtil).
function getGizmoTarget(): ObjectSelection | null
{
    if (!GameModeUtil.isInEditMode())
        return null;

    const selection = objectSelectionObservable.peek();
    if (!selection || selection.gameObject.params.objectTypeIndex !== canvasTypeIndex)
        return null;

    return selection;
}

async function refreshGizmos()
{
    if (!getGizmoTarget())
    {
        hideAll();
        return;
    }

    await ensureInitialized();

    // Creating the arrows is awaited, and what they were to be put up around may be gone by the time
    // that returns — the selection dropped, or edit mode left.
    const selection = getGizmoTarget();
    if (!selection)
    {
        hideAll();
        return;
    }

    updateGizmos(selection);
}

function updateGizmos(selection: ObjectSelection)
{
    const go = selection.gameObject;

    const room = App.getCurrentRoom();
    if (!room)
    {
        hideAll();
        return;
    }

    const user = App.getUser();

    const objectId = go.params.objectId;
    const obj = room.objectById[objectId];
    const pos = go.position;

    vec3Dir.set(go.params.transform.dir.x, go.params.transform.dir.y, go.params.transform.dir.z);
    vec3Right.crossVectors(DIRECTION_VECTORS["+y"], vec3Dir).normalize().negate();

    for (let i = 0; i < arrowDefs.length; ++i)
    {
        const def = arrowDefs[i];
        const arrow = arrows[i];

        const result = WallAttachedObjectUtil.getMoveResult(room, obj, def.dx, def.dy, def.dz);
        const canMove = result != undefined &&
            ObjectUpdateUtil.canSetObjectTransform(user, room,
                new SetObjectTransformSignal(room.id, objectId,
                    new ObjectTransform(result.newPos, result.newDir), true));

        arrow.setVisible(canMove);

        // Calculate arrow position: at the edge of the canvas square
        let arrowX = pos.x;
        let arrowY = pos.y;
        let arrowZ = pos.z;

        if (def.dx !== 0 && def.dy === 0) // horizontal movement
        {
            // Place arrow along the local right direction at the edge
            const sign = def.dx > 0 ? 1 : -1;
            arrowX += vec3Right.x * EDGE_OFFSET * sign;
            arrowZ += vec3Right.z * EDGE_OFFSET * sign;

            // Orient arrow along local right axis
            vec3LocalDir.copy(vec3Right).multiplyScalar(sign);
            arrow.setDirection(vec3LocalDir);
        }
        else if (def.dx === 0 && def.dy !== 0) // vertical movement
        {
            const sign = def.dy > 0 ? 1 : -1;
            arrowY += EDGE_OFFSET * sign;

            // Orient arrow along global up/down
            arrow.setDirection(sign > 0 ? DIRECTION_VECTORS["+y"] : DIRECTION_VECTORS["-y"]);
        }
        else
        {
            throw new Error(`Attempted a diagonal movement (dx = ${def.dx}, dy = ${def.dy})`);
        }

        arrow.setPosition(arrowX, arrowY, arrowZ);
        arrow.setOnClick(canMove ? () => {
            tryMoveCanvas(selection, def.dx, def.dy, def.dz);
        } : null);
    }
}

function tryMoveCanvas(selection: ObjectSelection,
    dx: number, dy: number, dz: number)
{
    try {
        const room = App.getCurrentRoom();
        if (!room)
            return;

        const objectId = selection.gameObject.params.objectId;
        const obj = room.objectById[objectId];
        const result = WallAttachedObjectUtil.getMoveResult(room, obj, dx, dy, dz);
        if (!result)
            return;

        const tr = ClientObjectManager.setObjectTransform(objectId, result.newPos, result.newDir, true);

        // Notify the observable to update the selection outline and gizmo positions
        objectSelectionObservable.notify();

        // Emit to server
        if (room.roomType != RoomTypeEnumMap.SinglePlayer)
            SocketsClient.emitSetObjectTransformSignal(new SetObjectTransformSignal(room.id, objectId, tr, true));
    } catch (err) {
        console.error(`Exception while trying to move a canvas :: Error: ${ErrorUtil.getErrorMessage(err)}`);
    }
}

// --- Observable listeners ---

objectSelectionObservable.addListener("canvasWorldSpaceGizmos", refreshGizmos);

// The mode decides whether a selected canvas is something being changed or merely something being
// looked at, so a change of mode puts the arrows up or takes them down even when the canvas under
// them stayed exactly as it was.
gameModeObservable.addListener("canvasWorldSpaceGizmos", refreshGizmos);

roomChangedObservable.addListener("canvasWorldSpaceGizmos", (_roomRuntimeMemory: RoomRuntimeMemory) => {
    hideAll();
    for (const arrow of arrows)
        arrow.dispose();
    arrows = [];
    initialized = false;
});

updateObservable.addListener("canvasWorldSpaceGizmos", () => {
    for (const arrow of arrows)
        arrow.update();
});
