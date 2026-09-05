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
import RoomValidationUtil from "../../../../shared/room/util/roomValidationUtil";
import WallAttachedObjectUtil from "../../../../shared/object/util/wallAttachedObjectUtil";
import ClientObjectManager from "../../../object/clientObjectManager";
import ErrorUtil from "../../../../shared/system/util/errorUtil";
import ObjectTransform from "../../../../shared/object/types/objectTransform";
import { DIRECTION_VECTORS } from "../../../system/clientConstants";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import { DOOR_FOOTPRINT_HEIGHT, DOOR_FOOTPRINT_WIDTH } from "../../../../shared/system/sharedConstants";

const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");

// The same four ways a wall attachment can be nudged along the wall it hangs on: a step to either
// side, and a step up or down. (For a wall-attached object, dx is along its own local x-axis.)
const arrowDefs = [
    { dir: "+x", dx: 0.5, dy: 0, dz: 0 },  // local right
    { dir: "-x", dx: -0.5, dy: 0, dz: 0 },  // local left
    { dir: "+y", dx: 0, dy: 0.5, dz: 0 },   // up
    { dir: "-y", dx: 0, dy: -0.5, dz: 0 },  // down
];

// How far past the door's own edge an arrow sits — the same hair's breadth a canvas's arrows stand
// off theirs, so an arrow reads as attached to the outline it is nudging rather than as floating
// somewhere near it. The two axes are measured separately only because a door's footprint is not
// square: the margin beyond each edge is the same.
const EDGE_MARGIN = 0.1;
const HORIZONTAL_EDGE_OFFSET = 0.5 * DOOR_FOOTPRINT_WIDTH + EDGE_MARGIN;
const VERTICAL_EDGE_OFFSET = 0.5 * DOOR_FOOTPRINT_HEIGHT + EDGE_MARGIN;

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

// The door the arrows are currently to be put up around, if any. Moving a door is world-building
// rather than room-editing, so the arrows belong to an admin in edit mode and to nobody else: for
// everyone else a door is a way out, and a click on it is a journey rather than a grip on it.
function getGizmoTarget(): ObjectSelection | null
{
    if (!GameModeUtil.isInEditMode())
        return null;

    const room = App.getCurrentRoom();
    if (!room || !RoomValidationUtil.canUserManageDoors(App.getUser(), room))
        return null;

    const selection = objectSelectionObservable.peek();
    if (!selection || selection.gameObject.params.objectTypeIndex !== doorTypeIndex)
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

        let arrowX = pos.x;
        let arrowY = pos.y;
        let arrowZ = pos.z;

        if (def.dx !== 0 && def.dy === 0) // horizontal movement
        {
            const sign = def.dx > 0 ? 1 : -1;
            arrowX += vec3Right.x * HORIZONTAL_EDGE_OFFSET * sign;
            arrowZ += vec3Right.z * HORIZONTAL_EDGE_OFFSET * sign;

            vec3LocalDir.copy(vec3Right).multiplyScalar(sign);
            arrow.setDirection(vec3LocalDir);
        }
        else if (def.dx === 0 && def.dy !== 0) // vertical movement
        {
            const sign = def.dy > 0 ? 1 : -1;
            arrowY += VERTICAL_EDGE_OFFSET * sign;
            arrow.setDirection(sign > 0 ? DIRECTION_VECTORS["+y"] : DIRECTION_VECTORS["-y"]);
        }
        else
        {
            throw new Error(`Attempted a diagonal movement (dx = ${def.dx}, dy = ${def.dy})`);
        }

        arrow.setPosition(arrowX, arrowY, arrowZ);
        arrow.setOnClick(canMove ? () => {
            tryMoveDoor(selection, def.dx, def.dy, def.dz);
        } : null);
    }
}

function tryMoveDoor(selection: ObjectSelection, dx: number, dy: number, dz: number)
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
        console.error(`Exception while trying to move a door :: Error: ${ErrorUtil.getErrorMessage(err)}`);
    }
}

// --- Observable listeners ---

objectSelectionObservable.addListener("doorWorldSpaceGizmos", refreshGizmos);

// The mode decides whether a selected door is something being moved or merely something being
// looked at, so a change of mode puts the arrows up or takes them down even when the door under
// them stayed exactly as it was.
gameModeObservable.addListener("doorWorldSpaceGizmos", refreshGizmos);

roomChangedObservable.addListener("doorWorldSpaceGizmos", (_roomRuntimeMemory: RoomRuntimeMemory) => {
    hideAll();
    for (const arrow of arrows)
        arrow.dispose();
    arrows = [];
    initialized = false;
});

updateObservable.addListener("doorWorldSpaceGizmos", () => {
    for (const arrow of arrows)
        arrow.update();
});
