import * as THREE from "three";
import GameObject from "../../../object/types/gameObject";
import { objectSelectionObservable, playerViewTargetPosObservable, roomChangedObservable } from "../../../system/clientObservables";
import VoxelQuadSelection from "./voxelQuadSelection";
import MeshFactory from "../../factories/meshFactory";
import GraphicsManager from "../../graphicsManager";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import WorldSpaceSelectionUtil from "../../util/worldSpaceSelectionUtil";

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
        objectSelectionObservable.set(null);
    }
}

let selectionLineSegmentsClone: THREE.LineSegments | null = null;

objectSelectionObservable.addListener("objectSelection", async (selection: ObjectSelection | null) => {
    if (selection)
    {
        // Initialize the line segments if they haven't been initialized yet.
        if (selectionLineSegmentsClone == null)
        {
            const lineSegments = await MeshFactory.loadLineSegments("Square", "#00ff00");
            selectionLineSegmentsClone = lineSegments.clone();
            GraphicsManager.getScene().add(selectionLineSegmentsClone);
        }

        const go = selection.gameObject;
        selectionLineSegmentsClone!.position.copy(go.position);
        selectionLineSegmentsClone!.quaternion.copy(go.quaternion);
        selectionLineSegmentsClone!.scale.copy(go.obj.scale);
        selectionLineSegmentsClone!.visible = true;

        // If an object is selected, the player's viewTarget should be that object's position.
        playerViewTargetPosObservable.set(new THREE.Vector3(go.position.x, go.position.y, go.position.z));

        // Also unselect any voxel quad selection (only if one is actually selected, to avoid circular triggering).
        if (VoxelQuadSelection.isSelected())
            VoxelQuadSelection.unselect();
    }
    else
    {
        if (selectionLineSegmentsClone != null)
            selectionLineSegmentsClone.visible = false;
    }

    // Is nothing selected at all? Then just set the viewTarget to NULL.
    if (!WorldSpaceSelectionUtil.isAnythingSelected())
        playerViewTargetPosObservable.set(null);
});

// Whenever the current room changes,
// the existing selection (if there is one) should be discarded.
roomChangedObservable.addListener("objectSelection", async (_roomRuntimeMemory: RoomRuntimeMemory) => {
    ObjectSelection.unselect();

    if (selectionLineSegmentsClone)
    {
        selectionLineSegmentsClone.removeFromParent();
        selectionLineSegmentsClone = null;
    }
});