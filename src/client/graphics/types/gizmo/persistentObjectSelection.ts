import * as THREE from "three";
import GameObject from "../../../object/types/gameObject";
import { persistentObjectSelectionObservable, playerViewTargetPosObservable, roomChangedObservable, voxelQuadSelectionObservable } from "../../../system/clientObservables";
import MeshFactory from "../../factories/meshFactory";
import WireframeMaterialParams from "../material/wireframeMaterialParams";
import GraphicsManager from "../../graphicsManager";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import WorldSpaceSelectionUtil from "../../util/worldSpaceSelectionUtil";

export default class PersistentObjectSelection
{
    gameObject: GameObject;

    constructor(gameObject: GameObject)
    {
        this.gameObject = gameObject;
    }

    static isSelected(): boolean
    {
        return persistentObjectSelectionObservable.peek() != null;
    }

    static trySelect(gameObject: GameObject): boolean
    {
        const existingSelection = persistentObjectSelectionObservable.peek();

        if (existingSelection == null) // There was no selection before.
        {
            persistentObjectSelectionObservable.set(new PersistentObjectSelection(gameObject));
            return true;
        }
        else
        {
            if (existingSelection.gameObject === gameObject) // Selected the same object twice -> should deselect it.
            {
                persistentObjectSelectionObservable.set(null);
                return false;
            }
            else // Selected a different object while another one was selected.
            {
                persistentObjectSelectionObservable.set(new PersistentObjectSelection(gameObject));
                return true;
            }
        }
    }

    static unselect()
    {
        persistentObjectSelectionObservable.set(null);
    }
}

let selectionMeshClone: THREE.Mesh | null = null;

persistentObjectSelectionObservable.addListener("persistentObjectSelection", async (selection: PersistentObjectSelection | null) => {
    if (selection)
    {
        // Initialize the mesh if it hasn't been initialized yet.
        if (selectionMeshClone == null)
        {
            const mesh = await MeshFactory.loadMesh("Square", new WireframeMaterialParams("#00ff00"));
            selectionMeshClone = mesh.clone();
            GraphicsManager.getScene().add(selectionMeshClone);
        }

        const go = selection.gameObject;
        selectionMeshClone!.position.copy(go.position);
        selectionMeshClone!.quaternion.copy(go.quaternion);
        selectionMeshClone!.scale.copy(go.obj.scale);
        selectionMeshClone!.visible = true;

        // If a persistent object is selected, the player's viewTarget should be that object's position.
        // Also unselect any voxel quad selection.
        playerViewTargetPosObservable.set(new THREE.Vector3(go.position.x, go.position.y, go.position.z));
        voxelQuadSelectionObservable.set(null);
    }
    else
    {
        if (selectionMeshClone != null)
            selectionMeshClone.visible = false;
    }

    // Is nothing selected at all? Then just set the viewTarget to NULL.
    if (!WorldSpaceSelectionUtil.isAnythingSelected())
        playerViewTargetPosObservable.set(null);
});

// Whenever the current room changes,
// the existing selection (if there is one) should be discarded.
roomChangedObservable.addListener("persistentObjectSelection", async (_roomRuntimeMemory: RoomRuntimeMemory) => {
    PersistentObjectSelection.unselect();

    if (selectionMeshClone)
    {
        selectionMeshClone.removeFromParent();
        selectionMeshClone = null;
    }
});