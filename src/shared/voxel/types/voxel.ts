import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"
import { COLLISION_LAYER_FLOOR_AND_CEILING } from "../../physics/types/collisionLayer";
import { getVoxelQuad } from "../util/voxelQueryUtil";

export default class Voxel extends EncodableData
{
    gameObjectId: string;
    row: number;
    col: number;
    collisionLayerMask: number;
    quads: Uint8Array;

    constructor(collisionLayerMask: number, quads: Uint8Array)
    {
        super();
        this.gameObjectId = ""; // This field must be manually set via the "setGameObjectId" method.
        this.row = -1; // This field must be manually set via the "setCoordinates" method.
        this.col = -1; // This field must be manually set via the "setCoordinates" method.
        this.collisionLayerMask = collisionLayerMask;
        this.quads = quads;
    }

    setGameObjectId(id: string)
    {
        this.gameObjectId = id;
    }

    setCoordinates(row: number, col: number)
    {
        this.row = row;
        this.col = col;
    }

    encode(bufferState: BufferState)
    {
        if (this.collisionLayerMask < 0 || this.collisionLayerMask > 255)
            throw new Error(`Voxel's collisionLayerMask is out of its range (value found = ${this.collisionLayerMask}, range = [0:255])`);

        // Floor Byte
        bufferState.view[bufferState.byteIndex++] = getVoxelQuad(this, "y", "+", COLLISION_LAYER_FLOOR_AND_CEILING);

        // Ceiling Byte
        bufferState.view[bufferState.byteIndex++] = getVoxelQuad(this, "y", "-", COLLISION_LAYER_FLOOR_AND_CEILING);

        // CollisionLayerMask Byte
        bufferState.view[bufferState.byteIndex++] = this.collisionLayerMask;

        // 6-Byte CollisionLayer Contents
        let collisionLayer = 0;
        while (collisionLayer < COLLISION_LAYER_FLOOR_AND_CEILING)
        {
            if (((1 << collisionLayer) & this.collisionLayerMask) != 0)
            {
                bufferState.view[bufferState.byteIndex++] = getVoxelQuad(this, "y", "-", collisionLayer);
                bufferState.view[bufferState.byteIndex++] = getVoxelQuad(this, "y", "+", collisionLayer);
                bufferState.view[bufferState.byteIndex++] = getVoxelQuad(this, "x", "-", collisionLayer);
                bufferState.view[bufferState.byteIndex++] = getVoxelQuad(this, "x", "+", collisionLayer);
                bufferState.view[bufferState.byteIndex++] = getVoxelQuad(this, "z", "-", collisionLayer);
                bufferState.view[bufferState.byteIndex++] = getVoxelQuad(this, "z", "+", collisionLayer);
            }
            collisionLayer++;
        }
    }

    static decode(bufferState: BufferState): EncodableData
    {
        // Floor Byte
        const floor = bufferState.view[bufferState.byteIndex++];

        // Ceiling Byte
        const ceiling = bufferState.view[bufferState.byteIndex++];

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
        const quads = new Uint8Array(6 * numCollisionLayers + 2); // 2 is for floor and ceiling
        let quadIndex = 0;
        let collisionLayer = 0;
        while (collisionLayer < COLLISION_LAYER_FLOOR_AND_CEILING)
        {
            if (((1 << collisionLayer) & collisionLayerMask) != 0)
            {
                quads[quadIndex++] = bufferState.view[bufferState.byteIndex++];
                quads[quadIndex++] = bufferState.view[bufferState.byteIndex++];
                quads[quadIndex++] = bufferState.view[bufferState.byteIndex++];
                quads[quadIndex++] = bufferState.view[bufferState.byteIndex++];
                quads[quadIndex++] = bufferState.view[bufferState.byteIndex++];
                quads[quadIndex++] = bufferState.view[bufferState.byteIndex++];
            }
            collisionLayer++;
        }
        quads[quadIndex++] = ceiling; // -y
        quads[quadIndex++] = floor; // +y

        return new Voxel(collisionLayerMask, quads);
    }
}

//------------------------------------------------------------------------------
// Each Voxel's Binary-Encoded Format:
//------------------------------------------------------------------------------
//
// Layout: [Floor Byte][Ceiling Byte][CollisionLayerMask Byte][6-Byte CollisionLayer Content][6-Byte CollisionLayer Content]...
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
// Note: (Maximum memory size of a room's voxelGrid) = about 50KB
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Each Voxel-Quad's Binary-Encoded Format:
//------------------------------------------------------------------------------
//
// 1 bit to indicate whether the quad is shown or hidden (1 = shown, 0 = hidden)
// 7 bits for the quad's textureIndex
//
//------------------------------------------------------------------------------