import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_QUADS_PER_VOXEL,
    VOXEL_BLOCK_SHAPE_EMPTY } from "../../system/sharedConstants";
import VoxelQueryUtil from "../util/voxelQueryUtil";
import VoxelBlockShapeUtil from "../util/voxelBlockShapeUtil";
import VoxelQuadsRuntimeMemory from "./voxelQuadsRuntimeMemory";

let temp_quadsMem: VoxelQuadsRuntimeMemory;
let temp_row = -1;
let temp_col = -1;

// One cell of the grid. Its quads and its blocks' shapes live in the room's shared memory (quadsMem).
export default class Voxel extends EncodableData
{
    quadsMem: VoxelQuadsRuntimeMemory;
    gameObjectId: string; // This field must be manually set via the "setGameObjectId" method.
    row: number;
    col: number;

    constructor(quadsMem: VoxelQuadsRuntimeMemory, row: number, col: number)
    {
        super();
        this.quadsMem = quadsMem;
        this.gameObjectId = "";
        this.row = row;
        this.col = col;
    }

    setGameObjectId(id: string)
    {
        this.gameObjectId = id;
    }

    encode(bufferState: BufferState)
    {
        const quads = this.quadsMem.quads;
        const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(this.row, this.col);

        bufferState.view[bufferState.byteIndex++] =
            quads[startIndex + NUM_VOXEL_QUADS_PER_VOXEL - 2]; // Ceiling Byte (= second last quad of the voxel)
        bufferState.view[bufferState.byteIndex++] =
            quads[startIndex + NUM_VOXEL_QUADS_PER_VOXEL - 1]; // Floor Byte (= last quad of the voxel)

        // 2-Byte CollisionLayerMask, least significant byte first
        const collisionLayerMask = VoxelQueryUtil.getVoxelBlockLayerMask(this);
        bufferState.view[bufferState.byteIndex++] = collisionLayerMask & 0b11111111;
        bufferState.view[bufferState.byteIndex++] = (collisionLayerMask >> 8) & 0b11111111;

        // 6-Byte CollisionLayer Contents (NUM_VOXEL_QUADS_PER_COLLISION_LAYER = 6)
        let collisionLayer = COLLISION_LAYER_MIN;
        while (collisionLayer <= COLLISION_LAYER_MAX)
        {
            if (((1 << collisionLayer) & collisionLayerMask) != 0) // Layer holds a block
            {
                const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(this.row, this.col, collisionLayer);
                const shape = VoxelQueryUtil.getVoxelBlockShape(this, collisionLayer);
                for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
                {
                    bufferState.view[bufferState.byteIndex++] =
                        (quads[startIndex + i] & 0b01111111) | VoxelBlockShapeUtil.getStoredQuadBit(shape, i);
                }
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
        const quads = temp_quadsMem.quads;
        const blockShapes = temp_quadsMem.blockShapes;
        const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(temp_row, temp_col);

        quads[startIndex + NUM_VOXEL_QUADS_PER_VOXEL - 2] =
            bufferState.view[bufferState.byteIndex++]; // Ceiling Byte (= second last quad of the voxel)
        quads[startIndex + NUM_VOXEL_QUADS_PER_VOXEL - 1] =
            bufferState.view[bufferState.byteIndex++]; // Floor Byte (= last quad of the voxel)

        // 2-Byte CollisionLayerMask, least significant byte first
        const collisionLayerMaskLowByte = bufferState.view[bufferState.byteIndex++];
        const collisionLayerMaskHighByte = bufferState.view[bufferState.byteIndex++];
        const collisionLayerMask = collisionLayerMaskLowByte | (collisionLayerMaskHighByte << 8);

        // 6-Byte CollisionLayer Contents
        let collisionLayer = COLLISION_LAYER_MIN;
        while (collisionLayer <= COLLISION_LAYER_MAX)
        {
            const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(temp_row, temp_col, collisionLayer);
            const blockIndex = VoxelQueryUtil.getVoxelBlockIndex(temp_row, temp_col, collisionLayer);
            if (((1 << collisionLayer) & collisionLayerMask) != 0) // Layer holds a block
            {
                const shape = VoxelBlockShapeUtil.getStoredShape(bufferState.view, bufferState.byteIndex);
                if (shape == VOXEL_BLOCK_SHAPE_EMPTY || !VoxelBlockShapeUtil.isValid(shape))
                {
                    throw new Error(`Decoded voxel block shape is invalid (shape = ${shape.toString(2)}, ` +
                        `row = ${temp_row}, col = ${temp_col}, collisionLayer = ${collisionLayer})`);
                }
                for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
                    quads[i] = bufferState.view[bufferState.byteIndex++] & 0b01111111;
                blockShapes[blockIndex] = shape;
            }
            else // Layer holds none
            {
                for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
                    quads[i] = 0;
                blockShapes[blockIndex] = VOXEL_BLOCK_SHAPE_EMPTY;
            }
            collisionLayer++;
        }

        return new Voxel(temp_quadsMem, temp_row, temp_col);
    }

    toString(): string
    {
        const quads = this.quadsMem.quads;
        const quadStrs: string[] = [`(${this.row},${this.col}):`];
        const firstIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(this.row, this.col);
        for (let quadIndex = firstIndex; quadIndex < firstIndex + NUM_VOXEL_QUADS_PER_VOXEL; ++quadIndex)
        {
            const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
            const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
            const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
            const textureIndex = quads[quadIndex] & 0b01111111;
            // The quads that get encoded: those of a layer holding a block, and the floor and ceiling quads.
            if (VoxelQueryUtil.isVoxelBlockPresent(this, collisionLayer))
                quadStrs.push(`${orientation}${facingAxis} at ${collisionLayer} (texture ${textureIndex})`);
        }
        return quadStrs.join("\n        ");
    }
}

//------------------------------------------------------------------------------
// Each Voxel's Binary-Encoded Format:
//------------------------------------------------------------------------------
//
// Layout: [Ceiling Byte][Floor Byte][CollisionLayerMask Bytes][6-Byte CollisionLayer Content][6-Byte CollisionLayer Content]...
//
// [Ceiling Byte]:
//     8 bits for the ceiling's (-y) facing quad
//
// [Floor Byte]:
//     8 bits for the floor's (+y) facing quad
//
// [CollisionLayerMask Bytes]:
//     16 bits saying which of the voxel's layers hold a block, least significant byte first (e.g. Least significant bit represents whether the range y=[0,0.5] holds one, second least significant bit represents whether the range y=[0.5,1] holds one, and so on)
//     The mask is not kept in memory: it is worked out from the blocks when encoding, and only says which chunks follow.
//     Subsequent 6-byte chunks will correspond to the consecutive "1"s in the collisionLayerMask.
//     e.g. If the collisionLayerMask is 1000000000000101:
//         (1) The 1st subsequent 6-byte chunk will correspond to the quads surrounding the volume in y=[0,0.5] (= 1st layer from y=0)
//         (2) The 2nd subsequent 6-byte chunk will correspond to the quads surrounding the volume in y=[1,1.5] (= 3rd layer from y=0)
//         (3) The 3rd subsequent 6-byte chunk will correspond to the quads surrounding the volume in y=[7.5,8] (= 16th layer from y=0)
//
// [6-Byte CollisionLayer Content]:
//     8 bits for the (-y) facing quad
//     8 bits for the (+y) facing quad
//     8 bits for the (-x) facing quad
//     8 bits for the (+x) facing quad
//     8 bits for the (-z) facing quad
//     8 bits for the (+z) facing quad
//
// Note: (Maximum memory size of a room's voxelGrid) = about 100KB
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Each Voxel-Quad's Binary-Encoded Format:
//------------------------------------------------------------------------------
//
// 1 spare bit, which the quad itself does not use (see below)
// 7 bits for the quad's textureIndex
//
// Whether the quad is shown or hidden is not encoded: the room's blocks decide it (see VoxelQueryUtil.isVoxelQuadVisible).
//
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Each Voxel-Block's Shape, Within Its 6-Byte CollisionLayer Content:
//------------------------------------------------------------------------------
//
// A block fills all four half-cell sub-blocks of its cell layer, or two of them side by side, or one (see VoxelBlockShapeUtil).
// The spare bits of its four side quads say which are missing, one sub-block each:
//     spare bit of the (-x) facing quad: 1 if the sub-block at (lower x, lower z) is cut away
//     spare bit of the (+x) facing quad: 1 if the sub-block at (higher x, lower z) is cut away
//     spare bit of the (-z) facing quad: 1 if the sub-block at (lower x, higher z) is cut away
//     spare bit of the (+z) facing quad: 1 if the sub-block at (higher x, higher z) is cut away
// All clear is a whole block, which is what every block was before blocks had shapes. All set is no block at all, which is never stored (the mask leaves such a layer out).
// The spare bits of the (-y) and (+y) facing quads, and of the ceiling and floor quads, are unused (always 0).
//
//------------------------------------------------------------------------------
