import GameObjectComponent from "./gameObjectComponent";
import Voxel from "../../../shared/voxel/types/voxel";
import InstancedMeshGraphics from "./instancedMeshGraphics";
import GameObject from "../types/gameObject";
import VoxelQuadChange from "../../../shared/voxel/types/voxelQuadChange";
import App from "../../app";
import TexturePackMaterialParams from "../../graphics/types/material/texturePackMaterialParams";
import { getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadIndex, getVoxelQuadOrientationFromQuadIndex } from "../../../shared/voxel/util/voxelQueryUtil";
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
                1024, 1024, 128, 128, "staticImageFromURL");
            VoxelMeshInstancer.latestMaterialParams = materialParams;
            VoxelMeshInstancer.latestMaterialParamsSyncedRoomID = currentRoom.roomID;
        }
        // 51200 = (1024 voxels) * (((8 collisionLayers per voxel) * (6 quads per collisionLayer)) + (1 quad for floor) + (1 quad for ceiling))
        this.instancedMeshGraphics.setInstancingProperties(VoxelMeshInstancer.latestMaterialParams,
            "Square", 51200);
    }

    async onSpawn(): Promise<void>
    {        
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);

        const quads = this.voxel.quads;
        for (let quadIndex = 0; quadIndex < quads.length; ++quadIndex)
        {
            const facingAxis = getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
            const orientation = getVoxelQuadOrientationFromQuadIndex(quadIndex);
            const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(this.voxel.collisionLayerMask, quadIndex);
            const instanceId = getVoxelQuadInstanceId(
                32, this.voxel.row, this.voxel.col, facingAxis, orientation, collisionLayer);
            await this.instancedMeshGraphics.loadInstance(instanceId);
            this.updateVoxelQuadInstance(instanceId, facingAxis, orientation, collisionLayer, quads[quadIndex]);
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

        // instanceId = 50 * voxelIndex + 6 * collisionLayer + 2 * facingAxisCode + orientationCode
        const voxelIndex = Math.floor(instanceId / 50);
        if ((voxelIndex - this.voxel.col) / 32 != this.voxel.row)
            throw new Error(`Voxel index mismatch (voxelIndex = ${voxelIndex}, row = ${this.voxel.row}, col = ${this.voxel.col})`);
        
        const quadIndexOffsetInVoxel = instanceId - 50 * voxelIndex;
        const collisionLayer = Math.floor(quadIndexOffsetInVoxel / 6);
        const facingAxisCode = Math.floor((quadIndexOffsetInVoxel % 6) * 0.5);
        const facingAxis = facingAxisCode == 0 ? "y" : (facingAxisCode == 1 ? "x" : "z");
        const orientation = (quadIndexOffsetInVoxel % 2 == 0) ? "-" : "+";
        return getVoxelQuadIndex(this.voxel.collisionLayerMask, facingAxis, orientation, collisionLayer);
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
        if (isDevMode)
            debug_str = `${String(voxelQuadChange)}\n    -> `;

        const oldQuad = voxelQuadChange.oldQuad;
        const newQuad = voxelQuadChange.newQuad;
        const showOldQuad = (oldQuad & 0b10000000) != 0;
        const showNewQuad = (newQuad & 0b10000000) != 0;

        const instanceId = getVoxelQuadInstanceId(32, this.voxel.row, this.voxel.col,
            voxelQuadChange.facingAxis, voxelQuadChange.orientation, voxelQuadChange.collisionLayer);

        if (!showOldQuad && showNewQuad) // rent quad instance
        {
            this.updateVoxelQuadInstance(instanceId, voxelQuadChange.facingAxis, voxelQuadChange.orientation, voxelQuadChange.collisionLayer, newQuad);
            if (isDevMode)
                debug_str += `(Add Quad) newInstanceId: ${instanceId}`;
        }
        else if (!showOldQuad && showNewQuad) // return quad instance
        {
            this.instancedMeshGraphics.unloadInstance(instanceId);
            if (isDevMode)
                debug_str += `(Remove Quad) oldInstanceId: ${instanceId}`;
        }
        else // keep the current quad instance and only update the texture
        {
            this.updateTextureUV(instanceId, newQuad, voxelQuadChange.facingAxis, voxelQuadChange.collisionLayer);
            if (isDevMode)
                debug_str += `(Update Quad) existingInstanceId: ${instanceId}`;
        }

        if (isDevMode)
            console.log(debug_str);
    }

    private updateVoxelQuadInstance(instanceId: number,
        facingAxis: "x" | "y" | "z", orientation: "-" | "+", collisionLayer: number, quad: number)
    {
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);

        let xOffset = 0, yOffset = 0.25 + 0.5 * collisionLayer, zOffset = 0, dirX = 0, dirY = 0, dirZ = 0;
        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
            yOffset = (orientation == "+") ? 0 : 4;

        switch (facingAxis)
        {
            case "x":
                if (orientation == "+") { dirX = 1; dirY = 0; dirZ = 0; xOffset = 0.5; }
                else { dirX = -1; dirY = 0; dirZ = 0; xOffset = -0.5; }
                break;
            case "y":
                if (orientation == "+") { dirX = 0; dirY = 1; dirZ = 0; }
                else { dirX = 0; dirY = -1; dirZ = 0; }
                break;
            case "z":
                if (orientation == "+") { dirX = 0; dirY = 0; dirZ = 1; zOffset = 0.5; }
                else { dirX = 0; dirY = 0; dirZ = -1; zOffset = -0.5; }
                break;
            default:
                throw new Error(`Unknown facingAxis (${facingAxis})`);
        }
        this.instancedMeshGraphics.updateInstanceTransform(instanceId,
            xOffset, yOffset, zOffset,
            dirX, dirY, dirZ,
            1, (facingAxis == "y") ? 1 : 0.5, 1);
        this.updateTextureUV(instanceId, quad, facingAxis, collisionLayer);
    }

    private updateTextureUV(instanceId: number, quad: number, facingAxis: "x" | "y" | "z",
        collisionLayer: number)
    {
        let sampleOffsetX = 0; // [0,1]
        let sampleOffsetY = 0; // [0,1]
        let sampleScaleX = 1; // [0,1]
        let sampleScaleY = 1; // [0,1]
        if (facingAxis != "y")
        {
            sampleScaleY = 0.5;
            if (collisionLayer % 2 == 0)
                sampleOffsetY = 0.5;
        }
        this.instancedMeshGraphics.updateInstanceTextureUV(instanceId,
            quad & 0b01111111, sampleOffsetX, sampleOffsetY, sampleScaleX, sampleScaleY);
    }
}

function getVoxelQuadInstanceId(numGridCols: number, row: number, col: number,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+", collisionLayer: number): number
{
    const voxelIndex = row * numGridCols + col;
    const facingAxisCode = facingAxis == "y" ? 0 : (facingAxis == "x" ? 1 : 2);
    const orientationCode = orientation == "-" ? 0 : 1;
    // There are up to 50 quads per voxel
    // ((8 layers * (6 quads per layer)) + 1 quad for floor + 1 quad for ceiling)
    return 50 * voxelIndex + 6 * collisionLayer + 2 * facingAxisCode + orientationCode;
}