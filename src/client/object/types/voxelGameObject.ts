import * as THREE from "three";
import GameObject from "./gameObject";
import ObjectManager from "../objectManager";
import VoxelQuadSelection from "../../graphics/types/gizmo/voxelQuadSelection";
import Voxel from "../../../shared/voxel/types/voxel";
import InstancedMeshGraphics from "../components/instancedMeshGraphics";
import VoxelQuadChange from "../../../shared/voxel/types/voxelQuadChange";
import App from "../../app";
import TexturePackMaterialParams from "../../graphics/types/material/texturePackMaterialParams";
import { getFirstVoxelQuadIndexInVoxel, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadTransformDimensions } from "../../../shared/voxel/util/voxelQueryUtil";
import { NUM_VOXEL_QUADS_PER_VOXEL, NUM_VOXEL_QUADS_PER_ROOM, MAX_WORLDSPACE_SELECT_DIST_SQR } from "../../../shared/system/sharedConstants";
import ObjectSpawnParams from "../../../shared/object/types/objectSpawnParams";

let isDevMode: boolean | undefined;

export default class VoxelGameObject extends GameObject
{
    instancedMeshGraphics: InstancedMeshGraphics;
    static latestMaterialParams: TexturePackMaterialParams;
    static latestMaterialParamsSyncedRoomID: string = "";

    private voxel: Voxel | undefined;

    constructor(params: ObjectSpawnParams)
    {
        super(params);

        this.instancedMeshGraphics = this.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("VoxelGameObject requires InstancedMeshGraphics component");

        if (isDevMode === undefined)
            isDevMode = App.getEnv().mode == "dev";

        const currentRoom = App.getCurrentRoom();
        if (!currentRoom)
            throw new Error(`Current room not found.`);
        if (VoxelGameObject.latestMaterialParamsSyncedRoomID != currentRoom.id)
        {
            const materialParams = new TexturePackMaterialParams(currentRoom.texturePackPath,
                1024, 1024, 128, 128, "staticImageFromPath");
            VoxelGameObject.latestMaterialParams = materialParams;
            VoxelGameObject.latestMaterialParamsSyncedRoomID = currentRoom.id;
        }
        this.instancedMeshGraphics.setInstancingProperties(VoxelGameObject.latestMaterialParams,
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

    // "instanceId" is the ID of the voxelQuad's mesh instance that was
    // hit by the user's pointer input.
    onClick(instanceId: number, hitPoint: THREE.Vector3)
    {
        const player = ObjectManager.getMyPlayer();
        if (player == undefined)
        {
            console.error("My player not found in VoxelGameObject's onClick.");
            return;
        }
        const distSqr = hitPoint.distanceToSquared(player.position);
        if (distSqr > MAX_WORLDSPACE_SELECT_DIST_SQR)
            return;

        const voxel = this.getVoxel();
        VoxelQuadSelection.trySelect(voxel, instanceId);
    }

    getVoxel(): Voxel
    {
        if (!this.voxel)
            throw new Error(`Voxel has not been assigned (params = ${JSON.stringify(this.params)})`);
        return this.voxel;
    }

    setVoxel(voxel: Voxel): void
    {
        this.voxel = voxel;
        voxel.setGameObjectId(this.params.objectId);
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