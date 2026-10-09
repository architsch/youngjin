import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_QUADS_PER_COLLISION_LAYER,
    NUM_VOXEL_QUADS_PER_VOXEL } from "../../system/sharedConstants";
import VoxelQueryUtil from "../util/voxelQueryUtil";
import VoxelQuadsRuntimeMemory from "./voxelQuadsRuntimeMemory";

let temp_quadsMem: VoxelQuadsRuntimeMemory;
let temp_row = -1;
let temp_col = -1;

// One cell of the grid: a stack of blocks, one to a layer. Its quads live in the room's shared memory (quadsMem).
export default class Voxel extends EncodableData
{
    quadsMem: VoxelQuadsRuntimeMemory;
    gameObjectId: string; // This field must be manually set via the "setGameObjectId" method.
    row: number;
    col: number;

    // The layers that hold a block, one bit each from the lowest layer up.
    blockLayerMask: number;

    constructor(quadsMem: VoxelQuadsRuntimeMemory, row: number, col: number, blockLayerMask: number = 0)
    {
        super();
        this.quadsMem = quadsMem;
        this.gameObjectId = "";
        this.row = row;
        this.col = col;
        this.blockLayerMask = blockLayerMask;
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

        // 2-Byte BlockLayerMask, least significant byte first
        bufferState.view[bufferState.byteIndex++] = this.blockLayerMask & 0b11111111;
        bufferState.view[bufferState.byteIndex++] = (this.blockLayerMask >> 8) & 0b11111111;

        // 6-Byte CollisionLayer Contents (NUM_VOXEL_QUADS_PER_COLLISION_LAYER = 6)
        let collisionLayer = COLLISION_LAYER_MIN;
        while (collisionLayer <= COLLISION_LAYER_MAX)
        {
            if (((1 << collisionLayer) & this.blockLayerMask) != 0) // Layer holds a block
            {
                const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(this.row, this.col, collisionLayer);
                for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
                    bufferState.view[bufferState.byteIndex++] = quads[i] & 0b01111111;
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
        const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(temp_row, temp_col);

        // (The spare bit of a quad's byte is dropped wherever one is read, so quad memory holds texture indices alone.)
        quads[startIndex + NUM_VOXEL_QUADS_PER_VOXEL - 2] =
            bufferState.view[bufferState.byteIndex++] & 0b01111111; // Ceiling Byte (= second last quad of the voxel)
        quads[startIndex + NUM_VOXEL_QUADS_PER_VOXEL - 1] =
            bufferState.view[bufferState.byteIndex++] & 0b01111111; // Floor Byte (= last quad of the voxel)

        // 2-Byte BlockLayerMask, least significant byte first
        const blockLayerMaskLowByte = bufferState.view[bufferState.byteIndex++];
        const blockLayerMaskHighByte = bufferState.view[bufferState.byteIndex++];
        const blockLayerMask = blockLayerMaskLowByte | (blockLayerMaskHighByte << 8);

        // 6-Byte CollisionLayer Contents
        let collisionLayer = COLLISION_LAYER_MIN;
        while (collisionLayer <= COLLISION_LAYER_MAX)
        {
            const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(temp_row, temp_col, collisionLayer);
            const layerHoldsBlock = ((1 << collisionLayer) & blockLayerMask) != 0;
            for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
                quads[i] = layerHoldsBlock ? (bufferState.view[bufferState.byteIndex++] & 0b01111111) : 0;
            collisionLayer++;
        }

        return new Voxel(temp_quadsMem, temp_row, temp_col, blockLayerMask);
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
// Layout: [Ceiling Byte][Floor Byte][BlockLayerMask Bytes][6-Byte CollisionLayer Content][6-Byte CollisionLayer Content]...
//
// [Ceiling Byte]:
//     8 bits for the ceiling's (-y) facing quad
//
// [Floor Byte]:
//     8 bits for the floor's (+y) facing quad
//
// [BlockLayerMask Bytes]:
//     16 bits saying which of the voxel's layers hold a block, least significant byte first (e.g. Least significant bit represents whether the range y=[0,0.5] holds one, second least significant bit represents whether the range y=[0.5,1] holds one, and so on)
//     Subsequent 6-byte chunks will correspond to the consecutive "1"s in the mask.
//     e.g. If the mask is 1000000000000101:
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
// Note: (Maximum memory size of a room's voxelGrid) = about 400KB (see MAX_ENCODED_VOXEL_GRID_BYTES), which deflates to a small fraction of that wherever it is sent or stored
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Each Voxel-Quad's Binary-Encoded Format:
//------------------------------------------------------------------------------
//
// 1 spare bit, which is unused (always 0)
// 7 bits for the quad's textureIndex
//
// Whether the quad is shown or hidden is not encoded: the room's blocks decide it (see VoxelQueryUtil.isVoxelQuadVisible).
//
//------------------------------------------------------------------------------
