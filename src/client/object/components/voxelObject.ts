import GameObjectComponent from "./gameObjectComponent";
import Voxel from "../../../shared/voxel/types/voxel";
import InstancedMeshGraphics from "./instancedMeshGraphics";
import MaterialParams from "../../graphics/types/materialParams";
import App from "../../app";
import GameObject from "../types/gameObject";

const voxelObjectByInstanceId: { [instanceId: number]: VoxelObject } = {};

export default class VoxelObject extends GameObjectComponent
{
    instancedMeshGraphics: InstancedMeshGraphics | undefined;

    private voxel: Voxel | undefined;

    static get(instanceId: number): VoxelObject | undefined
    {
        return voxelObjectByInstanceId[instanceId];
    }

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);

        const instancedMeshGraphics = this.gameObject.components.instancedMeshGraphics;
        if (!instancedMeshGraphics)
            throw new Error("VoxelObject requires InstancedMeshGraphics component");
        this.instancedMeshGraphics = instancedMeshGraphics as InstancedMeshGraphics;

        this.instancedMeshGraphics.getMeshMaterialParams = (): MaterialParams =>
        {
            const currentRoom = App.getCurrentRoom();
            if (!currentRoom)
                throw new Error(`Current room not found.`);
            return {
                type: "Regular",
                additionalParam: currentRoom.texturePackURL,
            };
        };

        this.instancedMeshGraphics.getMeshGeometryId = (): string =>
        {
            return "Quad";
        };

        this.instancedMeshGraphics.getTotalNumInstances = (): number =>
        {
            return 8192;
        };

        this.instancedMeshGraphics.getNumInstancesToRent = (): number =>
        {
            if (this.voxel == undefined)
                throw new Error(`Voxel hasn't been defined yet.`);
            return this.voxel.quads.length;
        };

        this.instancedMeshGraphics.getMeshInstanceInfo = (indexInInstanceIdsArray: number)
            : { xOffset: number, yOffset: number, zOffset: number, dirX: number, dirY: number, dirZ: number, textureIndex: number } =>
        {
            if (this.voxel == undefined)
                throw new Error(`Voxel hasn't been defined yet.`);
            const quad = this.voxel.quads[indexInInstanceIdsArray];

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
        };
    }

    async onSpawn(): Promise<void>
    {        
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);
        for (const instanceId of this.instancedMeshGraphics!.instanceIds)
        {
            voxelObjectByInstanceId[instanceId] = this;
        }
        if (this.instancedMeshGraphics!.instanceIds.length == 0 && this.voxel.quads.length > 0)
            console.error(`No mesh instance found in a voxel that has at least one quad in it (quads: ${JSON.stringify(this.voxel.quads)})`);
    }

    async onDespawn(): Promise<void>
    {
        for (const instanceId of this.instancedMeshGraphics!.instanceIds)
            delete voxelObjectByInstanceId[instanceId];
    }

    getVoxel(): Voxel
    {
        if (!this.voxel)
            throw new Error(`Voxel has not been assigned (params = ${JSON.stringify(this.gameObject.params)})`);
        return this.voxel;
    }

    setVoxel(voxel: Voxel): void
    {
        this.voxel = voxel;
    }
}