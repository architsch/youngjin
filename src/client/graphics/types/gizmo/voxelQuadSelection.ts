import * as THREE from "three";
import Voxel from "../../../../shared/voxel/types/voxel";
import { persistentObjectSelectionObservable, playerViewTargetPosObservable, roomChangedObservable, voxelQuadSelectionObservable } from "../../../system/clientObservables";
import MeshFactory from "../../factories/meshFactory";
import WireframeMaterialParams from "../material/wireframeMaterialParams";
import GraphicsManager from "../../graphicsManager";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { NUM_VOXEL_QUADS_PER_ROOM } from "../../../../shared/system/sharedConstants";
import WorldSpaceSelectionUtil from "../../util/worldSpaceSelectionUtil";

const vec3Temp = new THREE.Vector3();

export default class VoxelQuadSelection
{
    voxel: Voxel;
    quadIndex: number;

    constructor(voxel: Voxel, quadIndex: number)
    {
        this.voxel = voxel;
        this.quadIndex = quadIndex;
    }

    static isSelected(): boolean
    {
        return voxelQuadSelectionObservable.peek() != null;
    }

    static trySelect(voxel: Voxel, quadIndex: number): boolean
    {
        // If the quadIndex doesn't even make sense, just unselect.
        if (quadIndex < 0 || quadIndex >= NUM_VOXEL_QUADS_PER_ROOM)
        {
            voxelQuadSelectionObservable.set(null);
            return false;
        }

        // If the quad is hidden, just unselect.
        const quad = voxel.quadsMem.quads[quadIndex];
        if ((quad & 0b10000000) == 0)
        {
            voxelQuadSelectionObservable.set(null);
            return false;
        }

        const existingSelection = voxelQuadSelectionObservable.peek();

        if (existingSelection == null) // There was no selection before.
        {
            voxelQuadSelectionObservable.set(new VoxelQuadSelection(voxel, quadIndex));
            return true;
        }
        else
        {
            if (existingSelection.voxel == voxel && existingSelection.quadIndex == quadIndex) // Selected the same quad twice -> should deselect it.
            {
                voxelQuadSelectionObservable.set(null);
                return false;
            }
            else // Selected a different quad while another one was selected.
            {
                voxelQuadSelectionObservable.set(new VoxelQuadSelection(voxel, quadIndex));
                return true;
            }
        }
    }

    static unselect()
    {
        voxelQuadSelectionObservable.set(null);
    }
}

let selectionMeshClone: THREE.Mesh | null = null;

voxelQuadSelectionObservable.addListener("voxelQuadSelection", async (selection: VoxelQuadSelection | null) => {
    if (selection)
    {
        // Initialize the mesh if it hasn't been initialized yet.
        if (selectionMeshClone == null)
        {
            const mesh = await MeshFactory.loadMesh("Square", new WireframeMaterialParams("#00ff00"));
            selectionMeshClone = mesh.clone();
            GraphicsManager.getScene().add(selectionMeshClone);
        }

        const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ, scaleX, scaleY, scaleZ } =
            VoxelQueryUtil.getVoxelQuadTransformDimensions(selection.voxel, selection.quadIndex);

        selectionMeshClone!.scale.set(scaleX, scaleY, scaleZ);
        selectionMeshClone!.position.set(
            selection.voxel.col + 0.5 + offsetX,
            offsetY,
            selection.voxel.row + 0.5 + offsetZ
        );
        const p = selectionMeshClone!.position;
        vec3Temp.set(p.x + dirX, p.y + dirY, p.z + dirZ);
        selectionMeshClone!.lookAt(vec3Temp);

        selectionMeshClone.visible = true;

        // If a voxelQuad is selected, the player's viewTarget should be the selected voxelQuad.
        // Also unselect any persistent object selection.
        playerViewTargetPosObservable.set(new THREE.Vector3(selection.voxel.col + 0.5 + offsetX, offsetY, selection.voxel.row + 0.5 + offsetZ));
        persistentObjectSelectionObservable.set(null);
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
roomChangedObservable.addListener("voxelQuadSelection", async (_roomRuntimeMemory: RoomRuntimeMemory) => {
    VoxelQuadSelection.unselect();

    if (selectionMeshClone)
    {
        selectionMeshClone.removeFromParent();
        selectionMeshClone = null;
    }
});