import * as THREE from "three";
import GameObject from "../../../object/types/gameObject";
import { clientFeatureFlagsObservable, objectSelectionObservable, playerViewTargetPosObservable, roomChangedObservable } from "../../../system/clientObservables";
import VoxelQuadSelection from "./voxelQuadSelection";
import GraphicsManager from "../../graphicsManager";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import WorldSpaceSelectionUtil from "../../util/worldSpaceSelectionUtil";
import { FeatureFlag } from "../../../../shared/system/types/featureFlag";
import WorldSpaceOutlineRect from "../../../ui/components/basic/worldspace/worldSpaceOutlineRect";

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
        if (clientFeatureFlagsObservable.has(FeatureFlag.DisableObjectSelectionChange))
            return false;
        const existingSelection = objectSelectionObservable.peek();

        if (existingSelection == null) // There was no selection before.
        {
            objectSelectionObservable.set(new ObjectSelection(gameObject));
            return true;
        }
        else
        {
            if (existingSelection.gameObject === gameObject) // Selected the same object twice -> should deselect it.
            {
                objectSelectionObservable.set(null);
                return false;
            }
            else // Selected a different object while another one was selected.
            {
                objectSelectionObservable.set(new ObjectSelection(gameObject));
                return true;
            }
        }
    }

    static unselect()
    {
        if (clientFeatureFlagsObservable.has(FeatureFlag.DisableObjectSelectionChange))
            return;
        objectSelectionObservable.set(null);
    }
}

let selectionOutline: WorldSpaceOutlineRect | null = null;

objectSelectionObservable.addListener("objectSelection", async (selection: ObjectSelection | null) => {
    if (selection)
    {
        // Initialize the outline if it hasn't been initialized yet.
        if (selectionOutline == null)
        {
            selectionOutline = await WorldSpaceOutlineRect.create("#00ff00");
            selectionOutline.addToParent(GraphicsManager.getScene());
        }

        const go = selection.gameObject;
        selectionOutline.setTransformRaw(go.position, go.quaternion, go.obj.scale);
        selectionOutline.setVisible(true);

        // If an object is selected, the player's viewTarget should be that object's position.
        playerViewTargetPosObservable.set(new THREE.Vector3(go.position.x, go.position.y, go.position.z));

        // Also unselect any voxel quad selection (only if one is actually selected, to avoid circular triggering).
        if (VoxelQuadSelection.isSelected())
            VoxelQuadSelection.unselect();
    }
    else
    {
        selectionOutline?.setVisible(false);
    }

    // Is nothing selected at all? Then just set the viewTarget to NULL.
    if (!WorldSpaceSelectionUtil.isAnythingSelected())
        playerViewTargetPosObservable.set(null);
});

// Whenever the current room changes,
// the existing selection (if there is one) should be discarded.
roomChangedObservable.addListener("objectSelection", async (_roomRuntimeMemory: RoomRuntimeMemory) => {
    ObjectSelection.unselect();

    if (selectionOutline)
    {
        selectionOutline.dispose();
        selectionOutline = null;
    }
});