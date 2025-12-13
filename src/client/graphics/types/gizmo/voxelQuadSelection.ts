import * as THREE from "three";
import Voxel from "../../../../shared/voxel/types/voxel";
import VoxelQuad from "../../../../shared/voxel/types/voxelQuad";
import { roomRuntimeMemoryObservable, voxelQuadSelectionObservable } from "../../../system/observables";
import MeshFactory from "../../factories/meshFactory";
import WireframeMaterialParams from "../material/wireframeMaterialParams";
import GraphicsManager from "../../graphicsManager";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import TexturePackMaterialParams from "../material/texturePackMaterialParams";

const vec3Temp = new THREE.Vector3();

export default class VoxelQuadSelection
{
    voxel: Voxel;
    voxelQuad: VoxelQuad;
    quadIndex: number;
    materialParams: TexturePackMaterialParams;

    constructor(voxel: Voxel, voxelQuad: VoxelQuad, quadIndex: number, materialParams: TexturePackMaterialParams)
    {
        this.voxel = voxel;
        this.voxelQuad = voxelQuad;
        this.quadIndex = quadIndex;
        this.materialParams = materialParams;
    }

    static trySelect(voxel: Voxel, voxelQuad: VoxelQuad, quadIndex: number, materialParams: TexturePackMaterialParams)
    {
        if (!listenersInitialized)
            initListeners();

        const existingSelection = voxelQuadSelectionObservable.peek();

        if (existingSelection == null) // There was no selection before.
        {
            voxelQuadSelectionObservable.set(new VoxelQuadSelection(voxel, voxelQuad, quadIndex, materialParams));
        }
        else
        {
            if (existingSelection.voxel == voxel && existingSelection.voxelQuad == voxelQuad) // Selected the same quad twice -> should deselect it.
            {
                voxelQuadSelectionObservable.set(null);
            }
            else // Selected a different quad while another one was selected.
            {
                voxelQuadSelectionObservable.set(new VoxelQuadSelection(voxel, voxelQuad, quadIndex, materialParams));
            }
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
                const mesh = await MeshFactory.loadMesh("Quad", new WireframeMaterialParams("#00ff00"));
                voxelQuadSelectionMeshClone = mesh.clone();
                GraphicsManager.getScene().add(voxelQuadSelectionMeshClone);
            }
            const centerX = selection.voxel.col + 0.5;
            const centerY = selection.voxelQuad.yOffset;
            const centerZ = selection.voxel.row + 0.5;
            let offsetX = 0, offsetZ = 0;
            let dirX = 0, dirY = 0, dirZ = 0;

            const orientation = selection.voxelQuad.orientation;
            switch (selection.voxelQuad.facingAxis)
            {
                case "x":
                    offsetX = (orientation == "+") ? 0.5 : -0.5;
                    dirX = (orientation == "+") ? 1 : -1;
                    break;
                case "y":
                    dirY = (orientation == "+") ? 1 : -1;
                    break;
                case "z":
                    offsetZ = (orientation == "+") ? 0.5 : -0.5;
                    dirZ = (orientation == "+") ? 1 : -1;
                    break;
                default:
                    throw new Error(`Unknown facingAxis value :: ${selection.voxelQuad.facingAxis}`);
            }

            voxelQuadSelectionMeshClone!.position.set(
                centerX + offsetX, centerY, centerZ + offsetZ);

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