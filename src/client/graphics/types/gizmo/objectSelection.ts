import * as THREE from "three";
import GameObject from "../../../object/types/gameObject";
import { clientFeatureFlagsObservable, gameModeObservable, objectSelectionObservable,
    roomChangedObservable, updateObservable } from "../../../system/clientObservables";
import GraphicsManager from "../../graphicsManager";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import WorldSpaceSelectionUtil from "../../util/worldSpaceSelectionUtil";
import { FeatureFlag } from "../../../../shared/system/types/featureFlag";
import WorldSpaceOutlineRect from "./generic/worldSpaceOutlineRect";

const outlinePos = new THREE.Vector3();
const outlineQuat = new THREE.Quaternion();
const outlineScale = new THREE.Vector3();

// What turns the outline — a unit square standing upright, facing the way its object faces — to lie
// flat on the ground instead.
const flatOnGroundQuat = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0), -0.5 * Math.PI);

// An object of the room, picked out by the user. Every kind of object is picked out this way, the
// user's own character included: what differs between one kind and the next is not how it is
// selected but what its selection brings out — the outline drawn around it, how the camera frames
// it, the panel of tools raised for it — and each kind says which of those it wants for itself (see
// ObjectTypeClientConfig).
export default class ObjectSelection
{
    gameObject: GameObject;

    constructor(gameObject: GameObject)
    {
        this.gameObject = gameObject;
    }

    static isSelected(): boolean
    {
        return objectSelectionObservable.peek() != null;
    }

    static trySelect(gameObject: GameObject): boolean
    {
        if (clientFeatureFlagsObservable.has(FeatureFlag.DisableObjectSelectionChange) ||
            clientFeatureFlagsObservable.has(FeatureFlag.DisableAllSelectionChange))
        {
            return false;
        }

        // Nothing is picked out outside edit mode (see GameModeUtil). A click is turned away before it
        // gets this far (see GameObject), so what this holds the line against is a selection asked
        // for by code instead — one re-picked by an edit whose answer arrives after the mode was left.
        if (gameModeObservable.peek() != "edit")
            return false;

        // Clicking what is already picked out leaves it picked out. A selection is given up by
        // saying so — the way out of the mode it stands in, or the back gesture — rather than by a
        // click that is indistinguishable from the one that made it: the user reaching for a tool
        // and catching the object underneath it should find the object still there.
        //
        // This is also what edit mode opens through (see GameModeUtil), which is why the call has to
        // report the object picked out whether or not it already was.
        const existingSelection = objectSelectionObservable.peek();
        if (existingSelection != null && existingSelection.gameObject === gameObject)
            return true;

        objectSelectionObservable.set(new ObjectSelection(gameObject));
        return true;
    }

    static unselect(force: boolean = false)
    {
        if (!force &&
            (clientFeatureFlagsObservable.has(FeatureFlag.DisableObjectSelectionChange) ||
            clientFeatureFlagsObservable.has(FeatureFlag.DisableAllSelectionChange)))
        {
            return;
        }
        objectSelectionObservable.set(null);
    }
}

let selectionOutline: WorldSpaceOutlineRect | null = null;

// Lays the outline over whatever is currently picked out.
//
// Where it goes follows from the box the object is collided with, and nothing here has to be told
// one kind of object from another. A wall attachment presents a face to the room and is outlined on
// it, upright and turned the way the object is turned: the picture, the door, the lamp. Anything
// else stands on the ground and is outlined on the ground beneath it, since a rectangle drawn
// through a character's middle marks him no better than one around his feet and is in his way while
// it does it. An object collided with nothing at all keeps its own square.
function refreshSelectionOutline(selection: ObjectSelection)
{
    if (!selectionOutline)
        return;

    const go = selection.gameObject;
    const collider = ObjectTypeConfigMap.getConfigByIndex(go.params.objectTypeIndex)
        .components.spawnedByAny?.collider;

    if (!collider)
    {
        selectionOutline.setTransformRaw(go.position, go.quaternion, go.obj.scale);
        return;
    }

    const size = collider.hitboxSize;
    if (collider.colliderType == "wallAttachment")
    {
        outlinePos.copy(go.position);
        outlineQuat.copy(go.quaternion);
        outlineScale.set(size.sizeX, size.sizeY, 1);
    }
    else
    {
        outlinePos.set(go.position.x, go.position.y - 0.5 * size.sizeY, go.position.z);
        outlineQuat.copy(flatOnGroundQuat);
        outlineScale.set(size.sizeX, size.sizeZ, 1);
    }
    selectionOutline.setTransformRaw(outlinePos, outlineQuat, outlineScale);
}

objectSelectionObservable.addListener("objectSelection", async (selection: ObjectSelection | null) => {
    if (!selection)
    {
        selectionOutline?.setVisible(false);
        return;
    }

    // Initialize the outline if it hasn't been initialized yet.
    if (selectionOutline == null)
    {
        selectionOutline = await WorldSpaceOutlineRect.create("#00ff00");
        selectionOutline.addToParent(GraphicsManager.getScene());
    }

    refreshSelectionOutline(selection);
    selectionOutline.setVisible(true);

    WorldSpaceSelectionUtil.unselectOthers("object");
});

// The outline is laid over the object afresh each frame rather than at the moment it was picked out,
// because an object can move while it is being held: the arrows slide a wall attachment along its
// wall, and a character caught mid-fall goes on falling after the mode has opened around him. An
// outline placed once would be left behind by either.
updateObservable.addListener("objectSelection", (_deltaTime: number) => {
    const selection = objectSelectionObservable.peek();
    if (selection && selectionOutline?.isVisible())
        refreshSelectionOutline(selection);
});

// Whenever the current room changes, the existing selection (if there is one) should be discarded.
// Forced: a room the user has left is not a room he can be holding anything in, and a scripted step
// pinning a selection was pinning it in the room that step was played in.
roomChangedObservable.addListener("objectSelection", async (_roomRuntimeMemory: RoomRuntimeMemory) => {
    ObjectSelection.unselect(true);

    if (selectionOutline)
    {
        selectionOutline.dispose();
        selectionOutline = null;
    }
});
