import * as THREE from "three";
import GameObject from "./gameObject";
import ClientObjectManager from "../clientObjectManager";
import VoxelQuadSelection from "../../graphics/types/gizmo/voxelQuadSelection";
import Voxel from "../../../shared/voxel/types/voxel";
import InstancedMeshGraphics from "../components/instancedMeshGraphics";
import VoxelQuadChange from "../../../shared/voxel/types/voxelQuadChange";
import App from "../../app";
import InstancedTexturePackMaterialParams from "../../../shared/graphics/material/types/instancedTexturePackMaterialParams";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import ClientVoxelQueryUtil from "../../voxel/util/clientVoxelQueryUtil";
import VoxelQuadInstanceUtil from "../../voxel/util/voxelQuadInstanceUtil";
import { NUM_VOXEL_QUADS_PER_VOXEL, MAX_VISIBLE_VOXEL_QUADS_PER_ROOM, VOXEL_TEXTURE_PACK_MATERIAL_ID, VOXEL_QUAD_GEOMETRY_ID } from "../../../shared/system/sharedConstants";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import { gameModeObservable, notificationMessageObservable, texturePackURLObservable, userRoleObservable } from "../../system/clientObservables";
import GraphicsManager from "../../graphics/graphicsManager";
import WorldSpaceSelectionUtil from "../../graphics/util/worldSpaceSelectionUtil";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";

let debugEnabled: boolean = false;
const vector3Temp = new THREE.Vector3();

export default class VoxelGameObject extends GameObject
{
    instancedMeshGraphics: InstancedMeshGraphics;
    static materialParams: InstancedTexturePackMaterialParams | undefined; // Caching mechanism to minimize computational burden (by preventing repetitive initialization of params)

    private voxel: Voxel | undefined;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshGraphics = this.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("VoxelGameObject requires InstancedMeshGraphics component");

        const currentTexturePackURL = texturePackURLObservable.peek();
        if (VoxelGameObject.materialParams?.texturePath !== currentTexturePackURL)
        {
            VoxelGameObject.materialParams = new InstancedTexturePackMaterialParams(currentTexturePackURL, 1024, 1024, 128, 128, "staticImageFromPath");
            // Pinning the material's id keeps the mesh these quads are drawn from the same one
            // across a change of texture pack, which is what lets the pack be swapped in place
            // rather than rebuilding the room's mesh (see InstancedMeshBinding).
            VoxelGameObject.materialParams.customMaterialId = VOXEL_TEXTURE_PACK_MATERIAL_ID;
        }
    }

    async onSpawn(): Promise<void>
    {
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);
        if (VoxelGameObject.materialParams == undefined)
            throw new Error(`Voxel material hasn't been defined yet.`);
        await super.onSpawn();

        // The mesh is sized for the quads a room can have on show at once rather than for every
        // quad the grid addresses, and its instances are borrowed from a pool for as long as a quad
        // is drawn (see VoxelQuadInstanceUtil).
        await this.instancedMeshGraphics.loadInstancedMesh(VOXEL_QUAD_GEOMETRY_ID,
            VoxelGameObject.materialParams, MAX_VISIBLE_VOXEL_QUADS_PER_ROOM, true);

        this.refreshAllQuads();
    }

    async onDespawn(): Promise<void>
    {
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);

        this.forEachQuadIndex(quadIndex => this.releaseVoxelQuadInstance(quadIndex));
    }

    // "instanceId" is the ID of the voxelQuad's mesh instance that was
    // hit by the user's pointer input. Which quad that instance is drawing has to be looked up,
    // since an instance is lent to whichever quad is on show rather than belonging to one
    // (see VoxelQuadInstanceUtil).
    onClick(instanceId: number, hitPoint: THREE.Vector3)
    {
        const player = ClientObjectManager.getMyPlayer();
        if (player == undefined)
        {
            console.error("My player not found in VoxelGameObject's onClick.");
            return;
        }

        GraphicsManager.getCamera().getWorldPosition(vector3Temp);
        if (hitPoint.distanceTo(vector3Temp) > WorldSpaceSelectionUtil.getMaxSelectDist())
            return;

        if (gameModeObservable.peek() == "edit")
        {
            const room = App.getCurrentRoom();
            if (room == undefined)
            {
                console.error("Current room not found.");
                return;
            }
            if (!RoomValidationUtil.canUserEditRoom(userRoleObservable.peek(), room))
            {
                notificationMessageObservable.set("You don't have permission to edit this room.");
                return;
            }
        }

        const quadIndex = VoxelQuadInstanceUtil.getQuadIndex(instanceId);
        if (quadIndex < 0)
            return; // The instance has been handed back since the ray was cast, so it draws nothing.

        VoxelQuadSelection.trySelect(this.getVoxel(), quadIndex);
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
        if (debugEnabled)
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
        this.forEachQuadIndex(quadIndex => this.updateVoxelQuadInstance(quadIndex));
    }

    // Brings one quad's instance into line with what the voxel now holds: a quad that has come into
    // view takes an instance out of the mesh's pool, one that has gone out of view hands its
    // instance back, and one that was already on show keeps the instance it had.
    updateVoxelQuadInstance(quadIndex: number)
    {
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);

        const quad = this.voxel.quadsMem.quads[quadIndex];
        if ((quad & 0b10000000) == 0) // The quad is not drawn, so it holds nothing to draw it with.
        {
            this.releaseVoxelQuadInstance(quadIndex);
            return;
        }

        const instancedMeshId = ClientVoxelQueryUtil.getVoxelInstancedMeshId();
        let instanceId = VoxelQuadInstanceUtil.getInstanceId(quadIndex);
        if (instanceId < 0)
        {
            const rentedInstanceId = this.instancedMeshGraphics.rentInstanceFromPool(instancedMeshId);
            if (rentedInstanceId == undefined)
                return; // The mesh is full, so this quad goes undrawn until one is handed back.
            instanceId = rentedInstanceId;
            VoxelQuadInstanceUtil.bind(quadIndex, instanceId);
        }

        const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ, scaleX, scaleY, scaleZ } = VoxelQueryUtil.getVoxelQuadTransformDimensions(this.voxel, quadIndex);
        this.instancedMeshGraphics.updateInstanceTransform(instancedMeshId, instanceId,
            offsetX, offsetY, offsetZ, dirX, dirY, dirZ, scaleX, scaleY, scaleZ);
        this.updateTextureUV(quadIndex, instanceId, quad, scaleX, scaleY);
    }

    private releaseVoxelQuadInstance(quadIndex: number)
    {
        const instanceId = VoxelQuadInstanceUtil.getInstanceId(quadIndex);
        if (instanceId < 0)
            return;
        VoxelQuadInstanceUtil.unbind(quadIndex, instanceId);
        this.instancedMeshGraphics.returnInstanceToPool(
            ClientVoxelQueryUtil.getVoxelInstancedMeshId(), instanceId);
    }

    // The quads this voxel owns, which are a contiguous run of the grid's quad indices.
    private forEachQuadIndex(handle: (quadIndex: number) => void)
    {
        const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(this.voxel!.row, this.voxel!.col);
        for (let quadIndex = startIndex; quadIndex < startIndex + NUM_VOXEL_QUADS_PER_VOXEL; ++quadIndex)
            handle(quadIndex);
    }

    private updateTextureUV(quadIndex: number, instanceId: number, quad: number,
        scaleX: number, scaleY: number)
    {
        const v = this.voxel!;
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        const sampleOffsetX = (scaleX < 1) ? (((v.row + v.col) % 2) * scaleX) : 0; // [0,1]
        const sampleOffsetY = (scaleY < 1 && collisionLayer % 2 == 0) ? scaleY : 0; // [0,1]
        const sampleScaleX = scaleX; // [0,1]
        const sampleScaleY = scaleY; // [0,1]

        this.instancedMeshGraphics.updateInstanceTextureUV(ClientVoxelQueryUtil.getVoxelInstancedMeshId(), instanceId,
            quad & 0b01111111, sampleOffsetX, sampleOffsetY, sampleScaleX, sampleScaleY);
    }
}