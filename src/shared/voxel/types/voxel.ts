import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_QUADS_PER_VOXEL } from "../../system/sharedConstants";
import { getFirstVoxelQuadIndexInLayer, getFirstVoxelQuadIndexInVoxel, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadOrientationFromQuadIndex } from "../util/voxelQueryUtil";
import VoxelQuadsRuntimeMemory from "./voxelQuadsRuntimeMemory";

let temp_quadsMem: VoxelQuadsRuntimeMemory;
let temp_row = -1;
let temp_col = -1;

export default class Voxel extends EncodableData
{
    quadsMem: VoxelQuadsRuntimeMemory;
    gameObjectId: string; // This field must be manually set via the "setGameObjectId" method.
    row: number;
    col: number;
    /*xShrinkMask: number;
    zShrinkMask: number;*/
    collisionLayerMask: number;

    constructor(quadsMem: VoxelQuadsRuntimeMemory, row: number, col: number,
        /*xShrinkMask: number, zShrinkMask: number,*/ collisionLayerMask: number)
    {
        super();
        this.quadsMem = quadsMem;
        this.gameObjectId = "";
        this.row = row;
        this.col = col;
        /*this.xShrinkMask = xShrinkMask;
        this.zShrinkMask = zShrinkMask;*/
        this.collisionLayerMask = collisionLayerMask;
    }

    setGameObjectId(id: string)
    {
        this.gameObjectId = id;
    }

    encode(bufferState: BufferState)
    {
        /*if (this.xShrinkMask < 0 || this.xShrinkMask > 255)
            throw new Error(`Voxel's xShrinkMask is out of its range (value found = ${this.xShrinkMask}, range = [0:255])`);
        if (this.zShrinkMask < 0 || this.zShrinkMask > 255)
            throw new Error(`Voxel's zShrinkMask is out of its range (value found = ${this.zShrinkMask}, range = [0:255])`);*/
        if (this.collisionLayerMask < 0 || this.collisionLayerMask > 255)
            throw new Error(`Voxel's collisionLayerMask is out of its range (value found = ${this.collisionLayerMask}, range = [0:255])`);

        /*// X-Shrink Byte
        bufferState.view[bufferState.byteIndex++] = this.xShrinkMask;

        // Z-Shrink Byte
        bufferState.view[bufferState.byteIndex++] = this.zShrinkMask;*/

        const quads = this.quadsMem.quads;
        const startIndex = getFirstVoxelQuadIndexInVoxel(this.row, this.col);
        
        bufferState.view[bufferState.byteIndex++] =
            quads[startIndex + NUM_VOXEL_QUADS_PER_VOXEL - 2]; // Floor Byte (= second last quad of the voxel)
        bufferState.view[bufferState.byteIndex++] =
            quads[startIndex + NUM_VOXEL_QUADS_PER_VOXEL - 1]; // Ceiling Byte (= last quad of the voxel)

        // CollisionLayerMask Byte
        bufferState.view[bufferState.byteIndex++] = this.collisionLayerMask;

        // 6-Byte CollisionLayer Contents (NUM_VOXEL_QUADS_PER_COLLISION_LAYER = 6)
        let collisionLayer = COLLISION_LAYER_MIN;
        while (collisionLayer <= COLLISION_LAYER_MAX)
        {
            if (((1 << collisionLayer) & this.collisionLayerMask) != 0) // Layer is occupied
            {
                const startIndex = getFirstVoxelQuadIndexInLayer(this.row, this.col, collisionLayer);
                for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
                    bufferState.view[bufferState.byteIndex++] = quads[i];
            }
            collisionLayer++;
        }
    }

    static decodeWithParams(bufferState: BufferState, quadsMem: VoxelQuadsRuntimeMemory, row: number, col: number): EncodableData
    {
        temp_quadsMem = quadsMem;
        temp_row = row;
        temp_col = col;
        return Voxel.decode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        /*// X-Shrink Byte
        const xShrinkMask = bufferState.view[bufferState.byteIndex++];

        // Z-Shrink Byte
        const zShrinkMask = bufferState.view[bufferState.byteIndex++];*/

        const quads = temp_quadsMem.quads;
        const startIndex = getFirstVoxelQuadIndexInVoxel(temp_row, temp_col);

        quads[startIndex + NUM_VOXEL_QUADS_PER_VOXEL - 2] =
            bufferState.view[bufferState.byteIndex++]; // Floor Byte (= second last quad of the voxel)
        quads[startIndex + NUM_VOXEL_QUADS_PER_VOXEL - 1] =
            bufferState.view[bufferState.byteIndex++]; // Ceiling Byte (= last quad of the voxel)

        // CollisionLayerMask Byte
        const collisionLayerMask = bufferState.view[bufferState.byteIndex++];

        let numCollisionLayers = 0;
        let collisionLayerMaskCopy = collisionLayerMask;
        while (collisionLayerMaskCopy != 0) // Count the number of 1s in collisionLayerMask's binary representation.
        {
            numCollisionLayers++;
            collisionLayerMaskCopy >>= 1;
        }

        // 6-Byte CollisionLayer Contents
        let collisionLayer = COLLISION_LAYER_MIN;
        while (collisionLayer <= COLLISION_LAYER_MAX)
        {
            const startIndex = getFirstVoxelQuadIndexInLayer(temp_row, temp_col, collisionLayer);
            if (((1 << collisionLayer) & collisionLayerMask) != 0) // Layer is occupied
            {               
                for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
                    quads[i] = bufferState.view[bufferState.byteIndex++];
            }
            else // Layer is NOT occupied
            {
                for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
                    quads[i] = 0;
            }
            collisionLayer++;
        }

        return new Voxel(temp_quadsMem, temp_row, temp_col, /*xShrinkMask, zShrinkMask,*/ collisionLayerMask);
    }

    toString(): string
    {
        const quads = this.quadsMem.quads;
        const quadStrs: string[] = [`(${this.row},${this.col}):`];
        const firstIndex = getFirstVoxelQuadIndexInVoxel(this.row, this.col);
        for (let quadIndex = firstIndex; quadIndex < firstIndex + NUM_VOXEL_QUADS_PER_VOXEL; ++quadIndex)
        {
            const facingAxis = getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
            const orientation = getVoxelQuadOrientationFromQuadIndex(quadIndex);
            const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
            const quad = quads[quadIndex];
            const showQuad = (quad & 0b10000000) != 0;
            const textureIndex = quad & 0b01111111;
            if (showQuad)
                quadStrs.push(`${orientation}${facingAxis} at ${collisionLayer} (texture ${textureIndex})`);
        }
        return quadStrs.join("\n        ");
    }
}

//------------------------------------------------------------------------------
// Each Voxel's Binary-Encoded Format:
//------------------------------------------------------------------------------
//
// Layout: [X-Shrink Byte][Z-Shrink Byte][Floor Byte][Ceiling Byte][CollisionLayerMask Byte][6-Byte CollisionLayer Content][6-Byte CollisionLayer Content]...
//
// [X-Shrink Byte]:
//     8-bit binary mask to indicate whether to shrink each collisionLayer's block in the X direction (to a fraction of the full block size).
//
// [Z-Shrink Byte]:
//     8-bit binary mask to indicate whether to shrink each collisionLayer's block in the Z direction (to a fraction of the full block size).
//
// [Floor Byte]:
//     8 bits for the floor's (+y) facing quad
//
// [Ceiling Byte]:
//     8 bits for the ceiling's (-y) facing quad
//
// [CollisionLayerMask Byte]:
//     8 bits for the voxel's collisionLayerMask (e.g. Least significant bit represents whether the range y=[0,0.5] is occupied, second least significant bit represents whether the range y=[0.5,1] is occupied, and so on)
//     Subsequent 6-byte chunks will correspond to the consecutive "1"s in the collisionLayerMask.
//     e.g. If the collisionLayerMask is 10000101:
//         (1) The 1st subsequent 6-byte chunk will correspond to the quads surrounding the volume in y=[0,0.5] (= 1st layer from y=0)
//         (2) The 2nd subsequent 6-byte chunk will correspond to the quads surrounding the volume in y=[1,1.5] (= 3rd layer from y=0)
//         (3) The 3rd subsequent 6-byte chunk will correspond to the quads surrounding the volume in y=[3.5,4] (= 8th layer from y=0)
//
// [6-Byte CollisionLayer Content]:
//     8 bits for the (-y) facing quad
//     8 bits for the (+y) facing quad
//     8 bits for the (-x) facing quad
//     8 bits for the (+x) facing quad
//     8 bits for the (-z) facing quad
//     8 bits for the (+z) facing quad
//
// Note: (Maximum memory size of a room's voxelGrid) = about 52KB
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Each Voxel-Quad's Binary-Encoded Format:
//------------------------------------------------------------------------------
//
// 1 bit to indicate whether the quad is shown or hidden (1 = shown, 0 = hidden)
// 7 bits for the quad's textureIndex
//
//------------------------------------------------------------------------------