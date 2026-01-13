import GameObjectComponent from "./gameObjectComponent";
import Voxel from "../../../shared/voxel/types/voxel";
import InstancedMeshGraphics from "./instancedMeshGraphics";
import GameObject from "../types/gameObject";
import VoxelQuadChange from "../../../shared/voxel/types/voxelQuadChange";
import App from "../../app";
import TexturePackMaterialParams from "../../graphics/types/material/texturePackMaterialParams";
import { getFirstVoxelQuadIndexInVoxel, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadTransformDimensions } from "../../../shared/voxel/util/voxelQueryUtil";
import { NUM_VOXEL_QUADS_PER_VOXEL, NUM_VOXEL_QUADS_PER_ROOM } from "../../../shared/system/constants";

let isDevMode: boolean | undefined;

export default class VoxelMeshInstancer extends GameObjectComponent
{
    instancedMeshGraphics: InstancedMeshGraphics;
    static latestMaterialParams: TexturePackMaterialParams;
    static latestMaterialParamsSyncedRoomID: number = 0;

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
                1024, 1024, 128, 128, "staticImageFromURL");
            VoxelMeshInstancer.latestMaterialParams = materialParams;
            VoxelMeshInstancer.latestMaterialParamsSyncedRoomID = currentRoom.roomID;
        }
        this.instancedMeshGraphics.setInstancingProperties(VoxelMeshInstancer.latestMaterialParams,
            "Square", NUM_VOXEL_QUADS_PER_ROOM);
    }

    async onSpawn(): Promise<void>
    {        
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);

        await this.instancedMeshGraphics.loadInstancedMesh();

        const startIndex = getFirstVoxelQuadIndexInVoxel(this.voxel.row, this.voxel.col);
        for (let quadIndex = startIndex; quadIndex < startIndex + NUM_VOXEL_QUADS_PER_VOXEL; ++quadIndex)
        {
            this.instancedMeshGraphics.reserveInstance(quadIndex);
            this.updateVoxelQuadInstance(quadIndex);
        }
    }

    async onDespawn(): Promise<void>
    {
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);

        const startIndex = getFirstVoxelQuadIndexInVoxel(this.voxel.row, this.voxel.col);
        for (let quadIndex = startIndex; quadIndex < startIndex + NUM_VOXEL_QUADS_PER_VOXEL; ++quadIndex)
        {
            this.instancedMeshGraphics.unreserveInstance(quadIndex);
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

    async applyVoxelQuadChange(voxelQuadChange: VoxelQuadChange)
    {
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);
        if (!this.instancedMeshGraphics)
        {
            console.error(`InstancedMeshGraphics is not set (voxelQuadChange: ${JSON.stringify(voxelQuadChange)})`);
            return;
        }
        this.updateVoxelQuadInstance(voxelQuadChange.quadIndex);
        if (isDevMode)
            console.log(String(voxelQuadChange));
    }

    updateVoxelQuadInstance(quadIndex: number)
    {
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);

        const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ, scaleX, scaleY, scaleZ } = getVoxelQuadTransformDimensions(this.voxel, quadIndex);
        this.instancedMeshGraphics.updateInstanceTransform(quadIndex, offsetX, offsetY, offsetZ, dirX, dirY, dirZ, scaleX, scaleY, scaleZ);
        this.updateTextureUV(quadIndex, scaleX, scaleY);
    }

    private updateTextureUV(quadIndex: number, scaleX: number, scaleY: number)
    {
        const v = this.voxel!;
        const quad = App.getVoxelQuads()[quadIndex];
        const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        const sampleOffsetX = (scaleX < 1) ? (((v.row + v.col) % 2) * scaleX) : 0; // [0,1]
        const sampleOffsetY = (scaleY < 1 && collisionLayer % 2 == 0) ? scaleY : 0; // [0,1]
        const sampleScaleX = scaleX; // [0,1]
        const sampleScaleY = scaleY; // [0,1]

        this.instancedMeshGraphics.updateInstanceTextureUV(quadIndex,
            quad & 0b01111111, sampleOffsetX, sampleOffsetY, sampleScaleX, sampleScaleY);
    }
}