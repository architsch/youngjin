import GameObjectComponent from "./gameObjectComponent";
import Voxel from "../../../shared/voxel/types/voxel";
import InstancedMeshGraphics from "./instancedMeshGraphics";
import GameObject from "../types/gameObject";
import VoxelQuadChange from "../../../shared/voxel/types/voxelQuadChange";
import App from "../../app";
import TexturePackMaterialParams from "../../graphics/types/material/texturePackMaterialParams";
import { getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadOrientationFromQuadIndex } from "../../../shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN } from "../../../shared/physics/types/collisionLayer";

let isDevMode: boolean | undefined;
let debug_str: string;

export default class VoxelMeshInstancer extends GameObjectComponent
{
    instancedMeshGraphics: InstancedMeshGraphics;
    static latestMaterialParams: TexturePackMaterialParams;
    static latestMaterialParamsSyncedRoomID: string = "";

    private voxel: Voxel | undefined;

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);

        this.instancedMeshGraphics = this.gameObject.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("VoxelMeshInstancer requires InstancedMeshGraphics component");

        if (isDevMode === undefined)
            isDevMode = App.getEnv().mode == "dev";

        const currentRoom = App.getCurrentRoom();
        if (!currentRoom)
            throw new Error(`Current room not found.`);
        if (VoxelMeshInstancer.latestMaterialParamsSyncedRoomID != currentRoom.roomID)
        {
            const materialParams = new TexturePackMaterialParams(currentRoom.texturePackURL,
                1024, 1024, 128, 64, "staticImageFromURL");
            VoxelMeshInstancer.latestMaterialParams = materialParams;
            VoxelMeshInstancer.latestMaterialParamsSyncedRoomID = currentRoom.roomID;
        }
        this.instancedMeshGraphics.setInstancingProperties(VoxelMeshInstancer.latestMaterialParams,
            "VoxelQuad", 17408);
    }

    async onSpawn(): Promise<void>
    {        
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);

        const quads = this.voxel.quads;
        for (let i = 0; i < quads.length; ++i)
        {
            const quad = quads[i];
            const instanceId = await this.instancedMeshGraphics.loadInstance();
            this.updateVoxelQuadInstance(instanceId, quad);
        }
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
        voxel.setGameObjectId(this.gameObject.params.objectId);
    }

    getVoxelQuadIndexAtInstance(instanceId: number): number
    {
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);
        const instanceIds = this.instancedMeshGraphics!.instanceIds;

        for (let quadIndex = 0; quadIndex < instanceIds.length; ++quadIndex)
        {
            if (instanceIds[quadIndex] == instanceId)
                return quadIndex;
        }
        throw new Error(`VoxelQuad not found (instanceId = ${instanceId}, instanceIds = ${JSON.stringify(instanceIds)})`);
    }

    async applyVoxelQuadChange(voxelQuadChange: VoxelQuadChange)
    {
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);
        if (!this.instancedMeshGraphics)
        {
            console.error(`InstancedMeshGraphics is not set (voxelQuadChange: ${JSON.stringify(voxelQuadChange)})`);
            return;
        }
        const instanceIds = this.instancedMeshGraphics.instanceIds;
        if (isDevMode)
            debug_str = `${String(voxelQuadChange)}\n    -> `;

        const quadIndex = voxelQuadChange.quadIndex;
        const oldQuad = this.voxel.quads[quadIndex];
        const newQuad = voxelQuadChange.newQuad;

        const showOldQuad = (oldQuad & 0b10000000) != 0;
        const showNewQuad = (newQuad & 0b10000000) != 0;

        if (!showOldQuad && showNewQuad) // rent quad instance
        {
            const newInstanceId = await this.instancedMeshGraphics.loadInstance();
            this.updateVoxelQuadInstance(newInstanceId, quadIndex);
            if (isDevMode)
                debug_str += `(Add Quad) newInstanceId: ${newInstanceId} -> instanceIds: ${instanceIds}`;
        }
        else if (!showOldQuad && showNewQuad) // return quad instance
        {
            const oldInstanceId = instanceIds[voxelQuadChange.quadIndex];
            this.instancedMeshGraphics.unloadInstance(oldInstanceId);
            if (isDevMode)
                debug_str += `(Remove Quad) oldInstanceId: ${oldInstanceId} -> instanceIds: ${instanceIds}`;
        }
        else // keep the current quad instance and only update the texture
        {
            const existingInstanceId = instanceIds[voxelQuadChange.quadIndex];
            this.instancedMeshGraphics.updateInstanceTextureIndex(existingInstanceId, newQuad & 0b01111111);
            if (isDevMode)
                debug_str += `(Update Quad) existingInstanceId: ${existingInstanceId} -> instanceIds: ${instanceIds}`;
        }

        if (isDevMode)
            console.log(debug_str);
    }

    private updateVoxelQuadInstance(instanceId: number, quadIndex: number)
    {
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);
        const quad = this.voxel.quads[quadIndex];
        const textureIndex = quad & 0b01111111;
        const facingAxis = getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = getVoxelQuadOrientationFromQuadIndex(quadIndex);
        const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(this.voxel.collisionLayerMask, quadIndex);

        // The texture of each quad instance (whose height captures only half of that of each texture sample in the atlas)
        // should alternate its UV coordinates between the upper and lower halves of the given textureIndex's texture sample
        // each time the collisionLayer increments.
        const instanceTextureIndex = textureIndex * 2 + (collisionLayer % 2);

        let xOffset = 0, yOffset = 0.25 + 0.5 * collisionLayer, zOffset = 0, dirX = 0, dirY = 0, dirZ = 0;
        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
            yOffset = (orientation == "+") ? 0 : 4;

        switch (facingAxis)
        {
            case "x":
                if (orientation == "+")
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
                if (orientation == "+")
                {
                    dirX = 0; dirY = 1; dirZ = 0;
                }
                else
                {
                    dirX = 0; dirY = -1; dirZ = 0;
                }
                break;
            case "z":
                if (orientation == "+")
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
                throw new Error(`Unknown facingAxis (${facingAxis})`);
        }
        this.instancedMeshGraphics.updateInstanceTransform(instanceId, xOffset, yOffset, zOffset, dirX, dirY, dirZ);
        this.instancedMeshGraphics.updateInstanceTextureIndex(instanceId, instanceTextureIndex);
    }
}