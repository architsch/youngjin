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
import WallAttachedObjectUtil from "../../../../shared/object/util/wallAttachedObjectUtil";
import ClientObjectManager from "../../../object/clientObjectManager";
import ErrorUtil from "../../../../shared/system/util/errorUtil";
import ObjectTransform from "../../../../shared/object/types/objectTransform";
import Room from "../../../../shared/room/types/room";
import User from "../../../../shared/user/types/user";
import { DIRECTION_VECTORS } from "../../../system/clientConstants";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";

// The four arrows that move a wall attachment along the wall it hangs on, put up around whichever
// one is currently picked out.
//
// Every wall attachment is moved in exactly the same way — WallAttachedObjectUtil settles where a
// step lands, corners and all — so what actually differs between one kind and the next is how big it
// is and who is allowed to move it. Those are the two things asked for here; everything else is the
// same set of arrows doing the same thing, and a copy per kind of object would only be four numbers
// of difference spread over a couple of hundred lines.
export default function installWallAttachmentMoveGizmos(config: WallAttachmentMoveGizmoConfig)
{
    // The same four ways a wall attachment can be nudged along the wall it hangs on: a step to
    // either side, and a step up or down. (For a wall-attached object, dx is along its own local
    // x-axis.)
    const arrowDefs = [
        { dir: "+x", dx: 0.5, dy: 0, dz: 0 },  // local right
        { dir: "-x", dx: -0.5, dy: 0, dz: 0 }, // local left
        { dir: "+y", dx: 0, dy: 0.5, dz: 0 },  // up
        { dir: "-y", dx: 0, dy: -0.5, dz: 0 }, // down
    ];

    // How far past the object's own edge an arrow sits, so an arrow reads as attached to the outline
    // it is nudging rather than as floating somewhere near it. The two axes are measured separately
    // only because a footprint need not be square: the margin beyond each edge is the same.
    const horizontalEdgeOffset = 0.5 * config.footprintWidth + EDGE_MARGIN;
    const verticalEdgeOffset = 0.5 * config.footprintHeight + EDGE_MARGIN;

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

    // The object the arrows are currently to be put up around, if any. Moving one is an edit, so the
    // arrows belong to edit mode alone: a click during play mode is a way of looking at the thing
    // and nothing more, and the tools for changing what was clicked stay away (see GameModeUtil).
    function getGizmoTarget(): ObjectSelection | null
    {
        if (!GameModeUtil.isInEditMode())
            return null;

        const room = App.getCurrentRoom();
        if (!room)
            return null;
        if (config.canUserMove != undefined && !config.canUserMove(App.getUser(), room))
            return null;

        const selection = objectSelectionObservable.peek();
        if (!selection || selection.gameObject.params.objectTypeIndex !== config.objectTypeIndex)
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

        // Creating the arrows is awaited, and what they were to be put up around may be gone by the
        // time that returns — the selection dropped, or edit mode left.
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

            // Notify the observable to update the selection outline and gizmo positions
            objectSelectionObservable.notify();

            // Emit to server
            if (room.roomType != RoomTypeEnumMap.SinglePlayer)
                SocketsClient.emitSetObjectTransformSignal(new SetObjectTransformSignal(room.id, objectId, tr, true));
        } catch (err) {
            console.error(`Exception while trying to move a wall attachment :: Error: ${ErrorUtil.getErrorMessage(err)}`);
        }
    }

    // --- Observable listeners ---

    objectSelectionObservable.addListener(config.listenerName, refreshGizmos);

    // The mode decides whether a selected object is something being moved or merely something being
    // looked at, so a change of mode puts the arrows up or takes them down even when the object
    // under them stayed exactly as it was.
    gameModeObservable.addListener(config.listenerName, refreshGizmos);

    roomChangedObservable.addListener(config.listenerName, (_roomRuntimeMemory: RoomRuntimeMemory) => {
        hideAll();
        for (const arrow of arrows)
            arrow.dispose();
        arrows = [];
        initialized = false;
    });

    updateObservable.addListener(config.listenerName, () => {
        for (const arrow of arrows)
            arrow.update();
    });
}

const EDGE_MARGIN = 0.1;
const ARROW_COLOR_HEX = "#ffff00";
const ARROW_SIZE = 2;

const vec3Dir = new THREE.Vector3();
const vec3Right = new THREE.Vector3();
const vec3LocalDir = new THREE.Vector3();

export interface WallAttachmentMoveGizmoConfig
{
    // What these listeners are registered under, which is what lets several kinds of attachment
    // each keep their own set of arrows.
    listenerName: string;
    objectTypeIndex: number;
    // The stretch of wall the object lays claim to, which is what the arrows are placed around —
    // its footprint rather than what is drawn, so the arrows frame the same rectangle the selection
    // outline does.
    footprintWidth: number;
    footprintHeight: number;
    // Whether this kind of object is the user's to move at all, for the kinds that are not
    // everybody's. Asked of the user and the room rather than of the object, because what it
    // answers is whether the tools come out — the individual step is checked regardless.
    canUserMove?: (user: User, room: Room) => boolean;
}
