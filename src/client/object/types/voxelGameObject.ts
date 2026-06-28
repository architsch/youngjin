import * as THREE from "three";
import GameObject from "./gameObject";
import ClientObjectManager from "../clientObjectManager";
import VoxelQuadSelection from "../../graphics/types/gizmo/voxelQuadSelection";
import Voxel from "../../../shared/voxel/types/voxel";
import InstancedMeshGraphics from "../components/instancedMeshGraphics";
import VoxelQuadChange from "../../../shared/voxel/types/voxelQuadChange";
import App from "../../app";
import InstancedTexturePackMaterialParams from "../../graphics/types/material/instancedTexturePackMaterialParams";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import { NUM_VOXEL_QUADS_PER_VOXEL, NUM_VOXEL_QUADS_PER_ROOM, MAX_WORLDSPACE_SELECT_DIST_SQR } from "../../../shared/system/sharedConstants";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import { texturePackURLObservable } from "../../system/clientObservables";

let isDevMode: boolean | undefined;

const VOXEL_TEXTURE_PACK_MATERIAL_ID = "voxelTexturePack";
export const VOXEL_QUAD_GEOMETRY_ID = "Square";

export default class VoxelGameObject extends GameObject
{
    instancedMeshGraphics: InstancedMeshGraphics;
    static latestMaterialParams: InstancedTexturePackMaterialParams | undefined; // Caching mechanism to minimize computational burden (by preventing repetitive initialization of params)

    private voxel: Voxel | undefined;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshGraphics = this.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("VoxelGameObject requires InstancedMeshGraphics component");

        if (isDevMode === undefined)
            isDevMode = App.getEnv().mode == "dev";

        const currentTexturePackURL = texturePackURLObservable.peek();
        if (VoxelGameObject.latestMaterialParams?.texturePath !== currentTexturePackURL)
        {
            VoxelGameObject.latestMaterialParams = new InstancedTexturePackMaterialParams(currentTexturePackURL, 1024, 1024, 128, 128, "staticImageFromPath");
            VoxelGameObject.latestMaterialParams.customMaterialId = VOXEL_TEXTURE_PACK_MATERIAL_ID;
        }
    }

    async onSpawn(): Promise<void>
    {        
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);
        if (VoxelGameObject.latestMaterialParams == undefined)
            throw new Error(`Voxel material hasn't been defined yet.`);
        await super.onSpawn();

        await this.instancedMeshGraphics.loadInstancedMesh(VOXEL_QUAD_GEOMETRY_ID,
            VoxelGameObject.latestMaterialParams, NUM_VOXEL_QUADS_PER_ROOM, false);

        const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(this.voxel.row, this.voxel.col);
        for (let quadIndex = startIndex; quadIndex < startIndex + NUM_VOXEL_QUADS_PER_VOXEL; ++quadIndex)
        {
            // Each voxel uses mesh instances at predefined indices instead of dynamically borrowing them from a pool.
            this.instancedMeshGraphics.reserveInstance(VOXEL_QUAD_GEOMETRY_ID,
                VoxelGameObject.latestMaterialParams, quadIndex);
            this.updateVoxelQuadInstance(quadIndex);
        }
    }

    async onDespawn(): Promise<void>
    {
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);

        const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(this.voxel.row, this.voxel.col);
        for (let quadIndex = startIndex; quadIndex < startIndex + NUM_VOXEL_QUADS_PER_VOXEL; ++quadIndex)
        {
            // Each voxel uses mesh instances at predefined indices instead of dynamically borrowing them from a pool.
            this.instancedMeshGraphics.unreserveInstance(VOXEL_QUAD_GEOMETRY_ID,
                VoxelGameObject.latestMaterialParams!, quadIndex);
        }
    }

    // "instanceId" is the ID of the voxelQuad's mesh instance that was
    // hit by the user's pointer input.
    onClick(instanceId: number, hitPoint: THREE.Vector3)
    {
        const player = ClientObjectManager.getMyPlayer();
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

    // Re-bakes this voxel's quad instances so they follow a cosmetic transform of "visualObj" (e.g.
    // EasingMotion's bounce). Each quad is recomputed from the voxel data, which composes the moved
    // visual node via InstancedMeshGraphics.
    onVisualTransformChanged(): void
    {
        this.refreshAllQuads();
    }

    // Re-applies every quad instance of this voxel from its current voxel data. Used both by the
    // cosmetic-transform refresh above and when the voxel is rebound to a new room's grid (voxel
    // objects persist across rooms — see ClientObjectManager.load — so their instances must be
    // refreshed against the new room's data instead of being recreated).
    refreshAllQuads(): void
    {
        if (this.voxel == undefined)
            return;
        const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(this.voxel.row, this.voxel.col);
        for (let quadIndex = startIndex; quadIndex < startIndex + NUM_VOXEL_QUADS_PER_VOXEL; ++quadIndex)
            this.updateVoxelQuadInstance(quadIndex);
    }

    updateVoxelQuadInstance(quadIndex: number)
    {
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);

        const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ, scaleX, scaleY, scaleZ } = VoxelQueryUtil.getVoxelQuadTransformDimensions(this.voxel, quadIndex);
        this.instancedMeshGraphics.updateInstanceTransform(VOXEL_QUAD_GEOMETRY_ID,
            VoxelGameObject.latestMaterialParams!, quadIndex,
            offsetX, offsetY, offsetZ, dirX, dirY, dirZ, scaleX, scaleY, scaleZ);
        this.updateTextureUV(quadIndex, scaleX, scaleY);
    }

    private updateTextureUV(quadIndex: number, scaleX: number, scaleY: number)
    {
        const v = this.voxel!;
        const quad = App.getVoxelQuads()[quadIndex];
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        const sampleOffsetX = (scaleX < 1) ? (((v.row + v.col) % 2) * scaleX) : 0; // [0,1]
        const sampleOffsetY = (scaleY < 1 && collisionLayer % 2 == 0) ? scaleY : 0; // [0,1]
        const sampleScaleX = scaleX; // [0,1]
        const sampleScaleY = scaleY; // [0,1]

        this.instancedMeshGraphics.updateInstanceTextureUV(VOXEL_QUAD_GEOMETRY_ID,
            VoxelGameObject.latestMaterialParams!, quadIndex,
            quad & 0b01111111, sampleOffsetX, sampleOffsetY, sampleScaleX, sampleScaleY);
    }
}