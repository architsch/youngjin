import * as THREE from "three";
import GameObject from "./gameObject";
import ClientObjectManager from "../../clientObjectManager";
import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";
import Voxel from "../../../../shared/voxel/types/voxel";
import InstancedMeshGraphics from "../../components/instancedMeshGraphics";
import VoxelQuadChange from "../../../../shared/voxel/types/voxelQuadChange";
import App from "../../../app";
import InstancedTexturePackMaterialParams from "../../../../shared/graphics/material/types/instancedTexturePackMaterialParams";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import VoxelQuadTransformDimensions from "../../../../shared/voxel/types/voxelQuadTransformDimensions";
import Geometry3DUtil from "../../../../shared/math/util/geometry3DUtil";
import ClientVoxelQueryUtil from "../../../voxel/util/clientVoxelQueryUtil";
import VoxelQuadInstanceUtil from "../../../voxel/util/voxelQuadInstanceUtil";
import { NUM_VOXEL_QUADS_PER_VOXEL, MAX_VISIBLE_VOXEL_QUADS_PER_ROOM, VOXEL_TEXTURE_PACK_MATERIAL_ID, VOXEL_QUAD_GEOMETRY_ID,
    NUM_PACK_VOXEL_TEXTURES, NUM_VOXEL_TEXTURE_COLS, NUM_VOXEL_TEXTURE_ROWS, PROCEDURAL_VOXEL_TEXTURE_MARGIN,
    VOXEL_TEXTURE_CELL_SIZE, NUM_VOXEL_COLS, MAX_ROOM_X } from "../../../../shared/system/sharedConstants";
import { VOXEL_GAME_OBJECT_SIZE_XZ } from "../../../system/clientConstants";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import { gameModeObservable, notificationMessageObservable, texturePackURLObservable } from "../../../system/clientObservables";
import GraphicsManager from "../../../graphics/graphicsManager";
import WorldSpaceSelectionUtil from "../../../graphics/util/worldSpaceSelectionUtil";
import RoomValidationUtil from "../../../../shared/room/util/roomValidationUtil";
import RestrictedZoneOutlineUtil, { RESTRICTED_ZONE_OUTLINE_COLOR } from "../../../voxel/util/restrictedZoneOutlineUtil";
import GameModeUtil from "../../../system/util/gameModeUtil";

let debugEnabled: boolean = false;
const vector3Temp = new THREE.Vector3();

// Draws the quads of the voxels in one square patch of the floor plan (see VOXEL_GAME_OBJECT_SIZE_XZ).
export default class VoxelGameObject extends GameObject
{
    // How many voxels a patch spans along each of its sides.
    static readonly numVoxelsPerSide = VOXEL_GAME_OBJECT_SIZE_XZ * NUM_VOXEL_COLS / MAX_ROOM_X;

    instancedMeshGraphics: InstancedMeshGraphics;
    static materialParams: InstancedTexturePackMaterialParams | undefined; // Caching mechanism to minimize computational burden (by preventing repetitive initialization of params)

    // The room's grid (its blocks decide which quads are drawn), and where in it the patch starts.
    private voxels: Voxel[] | undefined;
    private rowStart: number = 0;
    private colStart: number = 0;

    // How much of a texture's cell, all round, is no part of what tiles: none of a pack's own (see
    // PROCEDURAL_VOXEL_TEXTURE_MARGIN). Whatever shows the texture leaves it out.
    static getTextureMargin(textureIndex: number): number
    {
        return (textureIndex < NUM_PACK_VOXEL_TEXTURES) ? 0 : PROCEDURAL_VOXEL_TEXTURE_MARGIN;
    }

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshGraphics = this.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("VoxelGameObject requires InstancedMeshGraphics component");

        const currentTexturePackURL = texturePackURLObservable.peek();
        if (VoxelGameObject.materialParams?.texturePath !== currentTexturePackURL)
        {
            VoxelGameObject.materialParams = new InstancedTexturePackMaterialParams(currentTexturePackURL,
                NUM_VOXEL_TEXTURE_COLS * VOXEL_TEXTURE_CELL_SIZE, NUM_VOXEL_TEXTURE_ROWS * VOXEL_TEXTURE_CELL_SIZE,
                VOXEL_TEXTURE_CELL_SIZE, VOXEL_TEXTURE_CELL_SIZE, "staticImageFromPath");
            // Restricted zone outlines are drawn by the voxel material (see RestrictedZoneOutlineUtil).
            VoxelGameObject.materialParams.outlineColorHex = RESTRICTED_ZONE_OUTLINE_COLOR;
            // A fixed material id lets texture packs swap in place (see InstancedMeshBinding).
            VoxelGameObject.materialParams.customMaterialId = VOXEL_TEXTURE_PACK_MATERIAL_ID;
        }
    }

    async onSpawn(): Promise<void>
    {
        if (this.voxels == undefined)
            throw new Error(`Voxels haven't been defined yet.`);
        if (VoxelGameObject.materialParams == undefined)
            throw new Error(`Voxel material hasn't been defined yet.`);
        await super.onSpawn();

        // Sized for visible quads, not every addressable quad; instances are lent (see VoxelQuadInstanceUtil).
        await this.instancedMeshGraphics.loadInstancedMesh(VOXEL_QUAD_GEOMETRY_ID,
            VoxelGameObject.materialParams, MAX_VISIBLE_VOXEL_QUADS_PER_ROOM, true);

        this.refreshAllQuads();
    }

    async onDespawn(): Promise<void>
    {
        if (this.voxels == undefined)
            throw new Error(`Voxels haven't been defined yet.`);

        this.forEachQuadIndex(quadIndex => this.releaseVoxelQuadInstance(quadIndex));
    }

    // instanceId is looked up to find its current quad (see VoxelQuadInstanceUtil). Only the shared
    // click conditions apply, since voxels aren't selected as objects.
    trySelect(instanceId: number): boolean
    {
        if (!GameModeUtil.isInEditMode())
            return false;

        const quadIndex = VoxelQuadInstanceUtil.getQuadIndex(instanceId);
        if (quadIndex < 0)
            return false; // The instance has been handed back since the ray was cast, so it draws nothing.
        const voxel = VoxelQueryUtil.getVoxel(this.getVoxels(), VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
            VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex));
        return voxel != undefined && VoxelQuadSelection.trySelect(voxel, quadIndex);
    }

    private getVoxels(): Voxel[]
    {
        if (!this.voxels)
            throw new Error(`Voxels have not been assigned (params = ${JSON.stringify(this.params)})`);
        return this.voxels;
    }

    // Takes the voxels of a grid that lie in the patch starting at the given row and column.
    setVoxels(voxels: Voxel[], rowStart: number, colStart: number): void
    {
        this.voxels = voxels;
        this.rowStart = rowStart;
        this.colStart = colStart;
        this.forEachVoxel(voxel => voxel.setGameObjectId(this.params.objectId));
    }

    // Takes the same patch of another grid, for the room arrived in (see ClientObjectManager.load).
    rebindVoxels(voxels: Voxel[]): void
    {
        this.setVoxels(voxels, this.rowStart, this.colStart);
        this.refreshAllQuads();
    }

    async applyVoxelQuadChange(voxelQuadChange: VoxelQuadChange)
    {
        if (this.voxels == undefined)
            throw new Error(`Voxels haven't been defined yet.`);
        if (!this.instancedMeshGraphics)
        {
            console.error(`InstancedMeshGraphics is not set (voxelQuadChange: ${JSON.stringify(voxelQuadChange)})`);
            return;
        }
        this.updateVoxelQuadInstance(voxelQuadChange.quadIndex);
        if (debugEnabled)
            console.log(String(voxelQuadChange));
    }

    // Re-bakes quads to follow visualObj's cosmetic transform (the grid itself never moves).
    onTransformChanged(resized: boolean): void
    {
        super.onTransformChanged(resized);
        this.refreshAllQuads();
    }

    // Re-applies all quads from voxel data.
    refreshAllQuads(): void
    {
        if (this.voxels == undefined)
            return;
        this.forEachQuadIndex(quadIndex => this.updateVoxelQuadInstance(quadIndex));
    }

    // Rents an instance for a newly visible quad, returns it for a hidden one, or keeps it.
    updateVoxelQuadInstance(quadIndex: number)
    {
        if (this.voxels == undefined)
            throw new Error(`Voxels haven't been defined yet.`);

        if (!VoxelQueryUtil.isVoxelQuadVisible(this.voxels, quadIndex)) // The quad is not drawn, so it holds nothing to draw it with.
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

        // The quad lies by its own voxel's middle (see VoxelQuadTransformDimensions), and is placed from
        // this object's, which is the patch's.
        const dims = VoxelQueryUtil.getVoxelQuadTransformDimensions(this.voxels, quadIndex, true);
        const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ, scaleX, scaleY, scaleZ } = dims;
        const worldX = VoxelQueryUtil.getWorldXAtVoxelColCenter(VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex)) + offsetX;
        const worldZ = VoxelQueryUtil.getWorldZAtVoxelRowCenter(VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex)) + offsetZ;
        const pos = this.params.transform.pos;
        this.instancedMeshGraphics.updateInstanceTransform(instancedMeshId, instanceId,
            worldX - pos.x, offsetY - pos.y, worldZ - pos.z, dirX, dirY, dirZ, scaleX, scaleY, scaleZ);
        // (A grid's voxels share one quad memory.)
        this.updateTextureUV(quadIndex, instanceId, this.voxels[0].quadsMem.quads[quadIndex], dims, worldX, worldZ);
        // Set on every update: a recycled instance may still carry another quad's outline.
        InstancedMeshGraphics.setInstanceOutline(instancedMeshId, instanceId,
            RestrictedZoneOutlineUtil.getOutlineStrength(quadIndex));
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

    // The voxels of the patch. (A grid whose rows or columns don't divide into patches leaves the last short.)
    private forEachVoxel(handle: (voxel: Voxel) => void)
    {
        for (let row = this.rowStart; row < this.rowStart + VoxelGameObject.numVoxelsPerSide; ++row)
        {
            for (let col = this.colStart; col < this.colStart + VoxelGameObject.numVoxelsPerSide; ++col)
            {
                const voxel = VoxelQueryUtil.getVoxel(this.voxels!, row, col);
                if (voxel != undefined)
                    handle(voxel);
            }
        }
    }

    // The quads this object owns: each of its voxels' own, which are a contiguous run of the grid's quad indices.
    private forEachQuadIndex(handle: (quadIndex: number) => void)
    {
        this.forEachVoxel(voxel =>
        {
            const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(voxel.row, voxel.col);
            for (let quadIndex = startIndex; quadIndex < startIndex + NUM_VOXEL_QUADS_PER_VOXEL; ++quadIndex)
                handle(quadIndex);
        });
    }

    // worldX, worldZ: where the quad's middle lies in the room.
    private updateTextureUV(quadIndex: number, instanceId: number, quad: number,
        dims: VoxelQuadTransformDimensions, worldX: number, worldZ: number)
    {
        const { scaleX, scaleY } = dims;

        // The quad shows the part of the tile it lies over, a tile being a world unit across, so faces side
        // by side make up one tile between them: across, from where it starts along its own right. Up a
        // wall, a layer shows half a tile, the halves alternating so two layers show the whole; a floor or
        // ceiling goes by where it starts along its own up.
        const {right, up} = Geometry3DUtil.getAxisFacingBasis({x: dims.dirX, y: dims.dirY, z: dims.dirZ});
        const fractionOfTile = (along: number) => along - Math.floor(along);
        const sampleOffsetX = fractionOfTile(worldX * right.x + worldZ * right.z - 0.5 * scaleX); // [0,1)
        const sampleOffsetY = (VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex) == "y")
            ? fractionOfTile(worldX * up.x + worldZ * up.z - 0.5 * scaleY)
            : ((VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex) % 2 == 0) ? scaleY : 0); // [0,1)

        // What tiles of the texture's cell: all of a pack's own, and what is inside a procedural one's margin
        // (see PROCEDURAL_VOXEL_TEXTURE_MARGIN). The quad shows its share of that, in whole texels.
        const textureIndex = quad & 0b01111111;
        const margin = VoxelGameObject.getTextureMargin(textureIndex);
        const tileSize = VOXEL_TEXTURE_CELL_SIZE - 2 * margin;
        const cellX = (textureIndex % NUM_VOXEL_TEXTURE_COLS) * VOXEL_TEXTURE_CELL_SIZE;
        const cellY = Math.floor(textureIndex / NUM_VOXEL_TEXTURE_COLS) * VOXEL_TEXTURE_CELL_SIZE;

        this.instancedMeshGraphics.updateInstanceTextureRect(ClientVoxelQueryUtil.getVoxelInstancedMeshId(), instanceId,
            cellX + margin + sampleOffsetX * tileSize, cellY + margin + sampleOffsetY * tileSize,
            scaleX * tileSize, scaleY * tileSize);
    }
}