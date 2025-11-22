import App from "../../app";
import PersistentObjectMeshInstancer from "../../object/components/persistentObjectMeshInstancer";
import VoxelMeshInstancer from "../../object/components/voxelMeshInstancer";
import GameObject from "../../object/types/gameObject";
import InstancedMeshConfig from "../types/instancedMeshConfig";
import MaterialParams from "../types/materialParams";
import MeshInstanceParams from "../types/meshInstanceParams"

export const InstancedMeshConfigMap: {[instancedMeshConfigId: string]: InstancedMeshConfig} =
{
    "Voxel": {
        getMaterialParams: (gameObject: GameObject): MaterialParams =>
        {
            const currentRoom = App.getCurrentRoom();
            if (!currentRoom)
                throw new Error(`Current room not found.`);

            return {
                type: "Regular",
                additionalParam: currentRoom.texturePackURL,
            };
        },
        geometryId: "Quad",
        totalNumInstances: 8192,
        getNumInstancesToRent: (gameObject: GameObject): number =>
        {
            const instancer = gameObject.components.voxelMeshInstancer as VoxelMeshInstancer;
            const voxel = instancer.getVoxel();
            if (voxel == undefined)
                throw new Error(`Voxel hasn't been defined yet.`);
            return voxel.quads.length;
        },
        getMeshInstanceParams: (gameObject: GameObject, indexInInstanceIdsArray: number): MeshInstanceParams =>
        {
            const instancer = gameObject.components.voxelMeshInstancer as VoxelMeshInstancer;
            const voxel = instancer.getVoxel();
            if (voxel == undefined)
                throw new Error(`Voxel hasn't been defined yet.`);
            const quad = voxel.quads[indexInInstanceIdsArray];

            let xOffset = 0, yOffset = quad.yOffset, zOffset = 0, dirX = 0, dirY = 0, dirZ = 0;
            switch (quad.facingAxis)
            {
                case "x":
                    if (quad.orientation == "+")
                    {
                        dirX = 1; dirY = 0; dirZ = 0;
                        xOffset = 0.5;
                    }
                    else
                    {
                        dirX = -1; dirY = 0; dirZ = 0;
                        xOffset = -0.5;
                    }
                    break;
                case "y":
                    if (quad.orientation == "+")
                    {
                        dirX = 0; dirY = 1; dirZ = 0;
                    }
                    else
                    {
                        dirX = 0; dirY = -1; dirZ = 0;
                    }
                    break;
                case "z":
                    if (quad.orientation == "+")
                    {
                        dirX = 0; dirY = 0; dirZ = 1;
                        zOffset = 0.5;
                    }
                    else
                    {
                        dirX = 0; dirY = 0; dirZ = -1;
                        zOffset = -0.5;
                    }
                    break;
                default:
                    throw new Error(`Unknown facingAxis (${quad.facingAxis})`);
            }
            return {
                xOffset, yOffset, zOffset, dirX, dirY, dirZ,
                textureIndex: quad.textureIndex,
            };
        },
    },
    "Door": {
        getMaterialParams: (gameObject: GameObject): MaterialParams =>
        {
            const currentRoom = App.getCurrentRoom();
            if (!currentRoom)
                throw new Error(`Current room not found.`);

            return {
                type: "Regular",
                additionalParam: currentRoom.texturePackURL,
            };
        },
        geometryId: "Quad",
        totalNumInstances: 8192,
        getNumInstancesToRent: (gameObject: GameObject): number =>
        {
            return 1;
        },
        getMeshInstanceParams: (gameObject: GameObject, indexInInstanceIdsArray: number): MeshInstanceParams =>
        {
            const instancer = gameObject.components.persistentObjectMeshInstancer as PersistentObjectMeshInstancer;
            const persistentObject = instancer.getPersistentObject();
            if (persistentObject == undefined)
                throw new Error(`PersistentObject hasn't been defined yet.`);
            return {
                xOffset: 0, yOffset: 0, zOffset: 0.01, // Slightly offset the quad in the z-direction to let it be rendered on top of its overlapping VoxelQuads.
                dirX: 0, dirY: 0, dirZ: 1,
                textureIndex: instancer.componentConfig.textureIndex,
            };
        },
    },
}