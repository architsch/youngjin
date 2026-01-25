import * as THREE from "three";
import Voxel from "../../../../shared/voxel/types/voxel";
import { roomRuntimeMemoryObservable, updateVoxelGridObservable, voxelQuadSelectionObservable } from "../../../system/clientObservables";
import MeshFactory from "../../factories/meshFactory";
import WireframeMaterialParams from "../material/wireframeMaterialParams";
import GraphicsManager from "../../graphicsManager";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import { getVoxelQuadTransformDimensions } from "../../../../shared/voxel/util/voxelQueryUtil";
import { NUM_VOXEL_QUADS_PER_ROOM } from "../../../../shared/system/sharedConstants";

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

    static trySelect(voxel: Voxel, quadIndex: number): boolean
    {
        if (!listenersInitialized)
            initListeners();
        
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

function refresh()
{
    if (!listenersInitialized)
        initListeners();

    const existingSelection = voxelQuadSelectionObservable.peek();
    
    if (existingSelection != null)
    {
        const quadIndex = existingSelection.quadIndex;

        // If the quadIndex doesn't even make sense, just unselect.
        if (quadIndex < 0 || quadIndex >= NUM_VOXEL_QUADS_PER_ROOM)
            voxelQuadSelectionObservable.set(null);

        // If the quad is hidden, just unselect.
        const quad = existingSelection.voxel.quadsMem.quads[quadIndex];
        if ((quad & 0b10000000) == 0)
            voxelQuadSelectionObservable.set(null);

        // Force-refresh the current selection (in order to update the UI, in case of a minor modification such as a texture change).
        voxelQuadSelectionObservable.notify();
    }
}

let listenersInitialized = false;
let voxelQuadSelectionMeshClone: THREE.Mesh | null = null;

function initListeners()
{
    voxelQuadSelectionObservable.addListener("voxelQuadSelection", async (selection: VoxelQuadSelection | null) => {
        if (selection)
        {
            if (voxelQuadSelectionMeshClone == null)
            {
                const mesh = await MeshFactory.loadMesh("Square", new WireframeMaterialParams("#00ff00"));
                voxelQuadSelectionMeshClone = mesh.clone();
                GraphicsManager.getScene().add(voxelQuadSelectionMeshClone);
            }
            const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ, scaleX, scaleY, scaleZ } =
                getVoxelQuadTransformDimensions(selection.voxel, selection.quadIndex);

            voxelQuadSelectionMeshClone!.scale.set(scaleX, scaleY, scaleZ);
            voxelQuadSelectionMeshClone!.position.set(
                selection.voxel.col + 0.5 + offsetX,
                offsetY,
                selection.voxel.row + 0.5 + offsetZ
            );

            const p = voxelQuadSelectionMeshClone!.position;
            vec3Temp.set(p.x + dirX, p.y + dirY, p.z + dirZ);
            voxelQuadSelectionMeshClone!.lookAt(vec3Temp);

            voxelQuadSelectionMeshClone.visible = true;
        }
        else
        {
            if (voxelQuadSelectionMeshClone == null)
                console.error(`VoxelQuad selection's mesh was not instantiated.`);
            else
                voxelQuadSelectionMeshClone.visible = false;
        }
    });

    updateVoxelGridObservable.addListener("voxelQuadSelection", refresh);

    roomRuntimeMemoryObservable.addListener("voxelQuadSelection", async (roomRuntimeMemory: RoomRuntimeMemory) => {
        VoxelQuadSelection.unselect();

        if (voxelQuadSelectionMeshClone)
        {
            voxelQuadSelectionMeshClone.removeFromParent();
            voxelQuadSelectionMeshClone = null;
        }
        voxelQuadSelectionObservable.removeListener("voxelQuadSelection");
        updateVoxelGridObservable.removeListener("voxelQuadSelection");
        roomRuntimeMemoryObservable.removeListener("voxelQuadSelection");
        listenersInitialized = false;
    });

    listenersInitialized = true;
}