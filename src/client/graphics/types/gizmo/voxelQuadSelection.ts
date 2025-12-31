import * as THREE from "three";
import Voxel from "../../../../shared/voxel/types/voxel";
import { roomRuntimeMemoryObservable, voxelQuadSelectionObservable } from "../../../system/observables";
import MeshFactory from "../../factories/meshFactory";
import WireframeMaterialParams from "../material/wireframeMaterialParams";
import GraphicsManager from "../../graphicsManager";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import { getVoxelQuadTransformDimensions } from "../../../../shared/voxel/util/voxelQueryUtil";

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

    static trySelect(voxel: Voxel, quadIndex: number)
    {
        if (!listenersInitialized)
            initListeners();

        const existingSelection = voxelQuadSelectionObservable.peek();

        if (existingSelection == null) // There was no selection before.
        {
            voxelQuadSelectionObservable.set(new VoxelQuadSelection(voxel, quadIndex));
        }
        else
        {
            if (existingSelection.voxel == voxel && existingSelection.quadIndex == quadIndex) // Selected the same quad twice -> should deselect it.
                voxelQuadSelectionObservable.set(null);
            else // Selected a different quad while another one was selected.
                voxelQuadSelectionObservable.set(new VoxelQuadSelection(voxel, quadIndex));
        }
    }

    static unselect()
    {
        voxelQuadSelectionObservable.set(null);
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
                getVoxelQuadTransformDimensions(selection.quadIndex);

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

    roomRuntimeMemoryObservable.addListener("voxelQuadSelection", async (roomRuntimeMemory: RoomRuntimeMemory) => {
        VoxelQuadSelection.unselect();

        if (voxelQuadSelectionMeshClone)
        {
            voxelQuadSelectionMeshClone.removeFromParent();
            voxelQuadSelectionMeshClone = null;
        }
        voxelQuadSelectionObservable.removeListener("voxelQuadSelection");
        roomRuntimeMemoryObservable.removeListener("voxelQuadSelection");
        listenersInitialized = false;
    });

    listenersInitialized = true;
}