import * as THREE from "three";
import Voxel from "../../../../shared/voxel/types/voxel";
import { objectSelectionObservable, playerViewTargetPosObservable, roomChangedObservable, voxelQuadSelectionObservable } from "../../../system/clientObservables";
import MeshFactory from "../../factories/meshFactory";
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

let selectionLineSegmentsClone: THREE.LineSegments | null = null;

voxelQuadSelectionObservable.addListener("voxelQuadSelection", async (selection: VoxelQuadSelection | null) => {
    if (selection)
    {
        // Initialize the mesh if it hasn't been initialized yet.
        if (selectionLineSegmentsClone == null)
        {
            const lineSegments = await MeshFactory.loadLineSegments("Square", "#00ff00");
            selectionLineSegmentsClone = lineSegments.clone();
            // Force the selection outline to draw after voxel meshes, so it stays
            // visible even when the voxel InstancedMesh is later added to the scene
            // (e.g. after a texture pack swap rebuilds the mesh).
            selectionLineSegmentsClone.renderOrder = 9999;
            GraphicsManager.getScene().add(selectionLineSegmentsClone);
        }

        const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ, scaleX, scaleY, scaleZ } =
            VoxelQueryUtil.getVoxelQuadTransformDimensions(selection.voxel, selection.quadIndex);

        selectionLineSegmentsClone!.scale.set(scaleX, scaleY, scaleZ);
        selectionLineSegmentsClone!.position.set(
            selection.voxel.col + 0.5 + offsetX,
            offsetY,
            selection.voxel.row + 0.5 + offsetZ
        );
        const p = selectionLineSegmentsClone!.position;
        vec3Temp.set(p.x + dirX, p.y + dirY, p.z + dirZ);
        selectionLineSegmentsClone!.lookAt(vec3Temp);

        selectionLineSegmentsClone.visible = true;

        // If a voxelQuad is selected, the player's viewTarget should be the selected voxelQuad.
        playerViewTargetPosObservable.set(new THREE.Vector3(selection.voxel.col + 0.5 + offsetX, offsetY, selection.voxel.row + 0.5 + offsetZ));

        // Also unselect any object selection.
        objectSelectionObservable.set(null);
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
roomChangedObservable.addListener("voxelQuadSelection", async (_roomRuntimeMemory: RoomRuntimeMemory) => {
    VoxelQuadSelection.unselect();

    if (selectionLineSegmentsClone)
    {
        selectionLineSegmentsClone.removeFromParent();
        selectionLineSegmentsClone = null;
    }
});