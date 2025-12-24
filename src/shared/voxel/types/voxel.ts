import VoxelQuad from "./voxelQuad";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"

export default class Voxel extends EncodableData
{
    gameObjectId: string;
    row: number;
    col: number;
    collisionLayerMask: number;
    quads: VoxelQuad[];

    constructor(collisionLayerMask: number, quads: VoxelQuad[])
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
        if (this.quads.length > 31)
            throw new Error(`No more than 31 quads are allowed in a voxel (row = ${this.row}, col = ${this.col}, number of quads detected = ${this.quads.length})`);
        if (this.collisionLayerMask < 0 || this.collisionLayerMask > 255)
            throw new Error(`Voxel's collisionLayerMask is out of its range (value found = ${this.collisionLayerMask}, range = [0:255])`);

        // Voxel Byte 1
        bufferState.view[bufferState.byteIndex++] = this.collisionLayerMask;

        // Voxel Byte 2
        bufferState.view[bufferState.byteIndex++] = this.quads.length;

        const numQuads = this.quads.length;
        for (let i = 0; i < numQuads; ++i)
        {
            const quad = this.quads[i];
            const facingAxisCode = (quad.facingAxis == "x") ? 0 : ((quad.facingAxis == "y") ? 1 : 2);
            const dimensions = 6 * (quad.yOffset * 2) + 2 * facingAxisCode + (quad.orientation == "-" ? 0 : 1);
            if (i % 2 == 0)
            {
                bufferState.view[bufferState.byteIndex++] = (dimensions << 2) | (quad.textureIndex >> 4);
                bufferState.view[bufferState.byteIndex] = (quad.textureIndex & 0b1111) << 4;
            }
            else
            {
                bufferState.view[bufferState.byteIndex++] |= (dimensions >> 2);
                bufferState.view[bufferState.byteIndex++] = ((dimensions & 0b11) << 6) | quad.textureIndex;
            }
        }
        if (numQuads % 2 == 1)
            bufferState.byteIndex++;
    }

    static decode(bufferState: BufferState): EncodableData
    {
        // Voxel Byte 1
        const voxelByte1 = bufferState.view[bufferState.byteIndex++];
        const collisionLayerMask = voxelByte1;

        // Voxel Byte 2
        const voxelByte2 = bufferState.view[bufferState.byteIndex++];
        const numQuads = voxelByte2 & 0b11111;

        const quads = new Array<VoxelQuad>(numQuads);
        let byte1: number, byte2: number, dimensions: number, textureIndex: number;
        for (let i = 0; i < numQuads; ++i)
        {
            if (i % 2 == 0)
            {
                byte1 = bufferState.view[bufferState.byteIndex++];
                byte2 = bufferState.view[bufferState.byteIndex];
                dimensions = (byte1 >> 2);
                textureIndex = ((byte1 & 0b11) << 4) | (byte2 >> 4);
            }
            else
            {
                byte1 = bufferState.view[bufferState.byteIndex++];
                byte2 = bufferState.view[bufferState.byteIndex++];
                dimensions = ((byte1 & 0b1111) << 2) | (byte2 >> 6);
                textureIndex = (byte2 & 0b111111);
            }

            const yOffset = Math.floor(dimensions / 6) * 0.5;
            const orientation = (dimensions % 2 == 0) ? "-" : "+";
            const facingAxisCode = Math.floor(dimensions / 2) % 3;
            const facingAxis = (facingAxisCode == 0) ? "x" : ((facingAxisCode == 1) ? "y" : "z");
            quads[i] = new VoxelQuad(facingAxis, orientation, yOffset, textureIndex);
        }
        if (numQuads % 2 == 1)
            bufferState.byteIndex++;

        return new Voxel(collisionLayerMask, quads);
    }
}

//------------------------------------------------------------------------------
// Each Voxel's Binary-Encoded Format:
//------------------------------------------------------------------------------
//
// Layout: [Voxel Byte 1][Voxel Byte 2][Quad 1.5Byte][Quad 1.5Byte][Quad 1.5Byte][Quad 1.5Byte]...
//
// [Voxel Byte 1]:
//     8 bits for the voxel's collisionLayerMask
//
// [Voxel Byte 2]:
//     3 unused bits
//     5 bits for the number of quads in the voxel
//
// [Quad 1.5Byte]:
//     6 bits for the quad's dimensions (facingAxis, orientation, yOffset)
//         (See "Appendix A" for details)
//     6 bits for the quad's texture index
//
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Appendix A:
//------------------------------------------------------------------------------
// VoxelQuad's dimension encoding pattern:
//
// yOffset:        0.0  0.0  0.0  0.0  0.0  0.0  0.5  0.5  0.5  0.5  0.5  0.5  1.0  1.0  1.0  1.0  1.0  1.0 ... 4.0
// direction:      -x   +x   -y   +y   -z   +z   -x   +x   -y   +y   -z   +z   -x   +x   -y   +y   -z   +z  ... +z
// encoded value:   0    1    2    3    4    5    6    7    8    9   10   11   12   13   14   15   16   17  ... 53
//
// If we suppose that (encoded value = N), then:
//
// floor(N / 6) * 0.5 = yOffset
// N % 2 = orientation (0 for "-", 1 for "+")
// floor(N / 2) % 3 = facingAxis (0 for "x", 1 for "y", 2 for "z")
//------------------------------------------------------------------------------