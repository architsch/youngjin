import * as THREE from "three";
import ObjectSelection from "./objectSelection";
import { gameModeObservable, objectSelectionObservable, roomChangedObservable, updateObservable } from "../../../system/clientObservables";
import GameModeUtil from "../../../system/util/gameModeUtil";
import GraphicsManager from "../../graphicsManager";
import WorldSpaceArrow from "./generic/worldSpaceArrow";
import WorldSpaceOutlineRect from "./generic/worldSpaceOutlineRect";
import ObjectUpdateUtil from "../../../../shared/object/util/objectUpdateUtil";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import SetObjectTransformSignal from "../../../../shared/object/types/setObjectTransformSignal";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import WallAttachedObjectUtil from "../../../../shared/object/util/wallAttachedObjectUtil";
import ClientObjectManager from "../../../object/clientObjectManager";
import ErrorUtil from "../../../../shared/system/util/errorUtil";
import ObjectTransform from "../../../../shared/object/types/objectTransform";
import { DIRECTION_VECTORS } from "../../../system/clientConstants";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import ObjectTypeClientConfigMap from "../../../object/maps/objectTypeClientConfigMap";

// Arrows that nudge the selected wall attachment along its wall. One shared set (only one thing is
// selected); movement rules live in WallAttachedObjectUtil, sizing in the collider, and a type opts in
// via ObjectTypeClientConfig.

// dx is along the object's local x-axis.
const arrowDefs = [
    { dir: "+x", dx: 0.5, dy: 0, dz: 0 },  // local right
    { dir: "-x", dx: -0.5, dy: 0, dz: 0 }, // local left
    { dir: "+y", dx: 0, dy: 0.5, dz: 0 },  // up
    { dir: "-y", dx: 0, dy: -0.5, dz: 0 }, // down
];

const ARROW_COLOR_HEX = "#ffff00";
const ARROW_SIZE = 2;
// An arrow's origin is its shaft's midpoint, this far ahead of its tail (see WorldSpaceArrow).
const ARROW_TAIL_OFFSET = 0.05 * ARROW_SIZE;

const vec3Dir = new THREE.Vector3();
const vec3Right = new THREE.Vector3();
const vec3LocalDir = new THREE.Vector3();

let arrows: WorldSpaceArrow[] = [];
let initialized = false;

async function ensureInitialized()
{
    if (initialized) return;
    initialized = true;

    const scene = GraphicsManager.getScene();

    for (const def of arrowDefs)
    {
        const arrow = await WorldSpaceArrow.create(def.dir, ARROW_COLOR_HEX, ARROW_SIZE);
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

// The selection to put arrows around (edit mode only), with its collider footprint (matching the
// selection outline).
function getGizmoTarget(): {selection: ObjectSelection, footprintWidth: number,
    footprintHeight: number} | null
{
    if (!GameModeUtil.isInEditMode())
        return null;

    const room = App.getCurrentRoom();
    if (!room)
        return null;

    const selection = objectSelectionObservable.peek();
    if (!selection)
        return null;

    const objectTypeIndex = selection.gameObject.params.objectTypeIndex;
    if (!ObjectTypeClientConfigMap.getConfigByIndex(objectTypeIndex).selection?.showMoveGizmos)
        return null;

    const hitboxSize = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex)
        .components.spawnedByAny?.collider?.hitboxSize;
    if (!hitboxSize)
        return null;

    return {selection, footprintWidth: hitboxSize.sizeX, footprintHeight: hitboxSize.sizeY};
}

async function refreshGizmos()
{
    if (!getGizmoTarget())
    {
        hideAll();
        return;
    }

    await ensureInitialized();

    // Re-check: the selection or mode may have changed during the await.
    const target = getGizmoTarget();
    if (!target)
    {
        hideAll();
        return;
    }

    updateGizmos(target.selection, target.footprintWidth, target.footprintHeight);
}

function updateGizmos(selection: ObjectSelection, footprintWidth: number, footprintHeight: number)
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

    // Tails sit on the selection outline's edges.
    const horizontalEdgeOffset = WorldSpaceOutlineRect.getEdgeOffset(footprintWidth) + ARROW_TAIL_OFFSET;
    const verticalEdgeOffset = WorldSpaceOutlineRect.getEdgeOffset(footprintHeight) + ARROW_TAIL_OFFSET;

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
            arrowX += vec3Right.x * horizontalEdgeOffset * sign;
            arrowZ += vec3Right.z * horizontalEdgeOffset * sign;

            vec3LocalDir.copy(vec3Right).multiplyScalar(sign);
            arrow.setDirection(vec3LocalDir);
        }
        else if (def.dx === 0 && def.dy !== 0) // vertical movement
        {
            const sign = def.dy > 0 ? 1 : -1;
            arrowY += verticalEdgeOffset * sign;

            arrow.setDirection(sign > 0 ? DIRECTION_VECTORS["+y"] : DIRECTION_VECTORS["-y"]);
        }
        else
        {
            throw new Error(`Attempted a diagonal movement (dx = ${def.dx}, dy = ${def.dy})`);
        }

        arrow.setPosition(arrowX, arrowY, arrowZ);
        arrow.setOnClick(canMove ? () => {
            tryMove(selection, def.dx, def.dy, def.dz);
        } : null);
    }
}

function tryMove(selection: ObjectSelection, dx: number, dy: number, dz: number)
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

        // Moves the arrows and camera to the new position.
        objectSelectionObservable.notify();

        // Emit to server
        if (room.roomType != RoomTypeEnumMap.SinglePlayer)
            SocketsClient.emitSetObjectTransformSignal(new SetObjectTransformSignal(room.id, objectId, tr, true));
    } catch (err) {
        console.error(`Exception while trying to move a wall attachment :: Error: ${ErrorUtil.getErrorMessage(err)}`);
    }
}

// --- Observable listeners ---

objectSelectionObservable.addListener("wallAttachmentMoveGizmos", refreshGizmos);

gameModeObservable.addListener("wallAttachmentMoveGizmos", refreshGizmos);

roomChangedObservable.addListener("wallAttachmentMoveGizmos", (_roomRuntimeMemory: RoomRuntimeMemory) => {
    hideAll();
    for (const arrow of arrows)
        arrow.dispose();
    arrows = [];
    initialized = false;
});

updateObservable.addListener("wallAttachmentMoveGizmos", () => {
    for (const arrow of arrows)
        arrow.update();
});
