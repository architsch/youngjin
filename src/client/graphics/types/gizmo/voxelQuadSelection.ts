import * as THREE from "three";
import Voxel from "../../../../shared/voxel/types/voxel";
import { roomRuntimeMemoryObservable, voxelQuadSelectionObservable } from "../../../system/observables";
import MeshFactory from "../../factories/meshFactory";
import WireframeMaterialParams from "../material/wireframeMaterialParams";
import GraphicsManager from "../../graphicsManager";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import { getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadOrientationFromQuadIndex } from "../../../../shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN } from "../../../../shared/physics/types/collisionLayer";

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
            {
                voxelQuadSelectionObservable.set(null);
            }
            else // Selected a different quad while another one was selected.
            {
                voxelQuadSelectionObservable.set(new VoxelQuadSelection(voxel, quadIndex));
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
                const mesh = await MeshFactory.loadMesh("Square", new WireframeMaterialParams("#00ff00"));
                voxelQuadSelectionMeshClone = mesh.clone();
                GraphicsManager.getScene().add(voxelQuadSelectionMeshClone);
            }
            const quadIndex = selection.quadIndex;
            const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(selection.voxel.collisionLayerMask, quadIndex);

            const centerX = selection.voxel.col + 0.5;
            const centerZ = selection.voxel.row + 0.5;
            let offsetX = 0, offsetZ = 0;
            let dirX = 0, dirY = 0, dirZ = 0;

            const facingAxis = getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
            const orientation = getVoxelQuadOrientationFromQuadIndex(quadIndex);

            let centerY = 0.25 + 0.5 * collisionLayer;
            if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
                centerY = (orientation == "+") ? 0 : 4;

            switch (facingAxis)
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
                    throw new Error(`Unknown facingAxis value :: ${facingAxis}`);
            }

            voxelQuadSelectionMeshClone!.scale.set(1, (facingAxis == "y") ? 1 : 0.5, 1);

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