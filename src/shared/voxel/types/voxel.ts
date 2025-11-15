import VoxelQuad from "./voxelQuad";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"

export default class Voxel extends EncodableData
{
    row: number;
    col: number;
    collisionLayerMask: number;
    quads: VoxelQuad[];

    constructor(collisionLayerMask: number, quads: VoxelQuad[])
    {
        super();
        this.row = -1; // This field must be manually set via the "setCoordinates" method.
        this.col = -1; // This field must be manually set via the "setCoordinates" method.
        this.collisionLayerMask = collisionLayerMask;
        this.quads = quads;
    }

    setCoordinates(row: number, col: number)
    {
        this.row = row;
        this.col = col;
    }

    encode(bufferState: BufferState)
    {
        if (this.quads.length == 0)
            throw new Error(`Voxel has no quad in it (row = ${this.row}, col = ${this.col})`);
        if (this.quads.length > 16)
            throw new Error(`No more than 16 quads are allowed in a voxel (row = ${this.row}, col = ${this.col}, number of quads detected = ${this.quads.length})`);
        if (this.collisionLayerMask < 0 || this.collisionLayerMask > 0b1111)
            throw new Error(`Voxel's collisionLayerMask is out of its range (value found = ${this.collisionLayerMask}, range = [${0b0000}:${0b1111}])`);

        // Voxel Byte
        bufferState.view[bufferState.index++] =
            ((this.collisionLayerMask & 0b1111) << 4) |
            ((this.quads.length-1) & 0b1111);

        for (const quad of this.quads)
            quad.encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        // Voxel Byte
        const voxelByte = bufferState.view[bufferState.index++];
        const collisionLayerMask = (voxelByte >> 4) & 0b1111;
        const numQuads = (voxelByte & 0b1111) + 1;

        const quads = new Array<VoxelQuad>(numQuads);
        for (let i = 0; i < numQuads; ++i)
            quads[i] = VoxelQuad.decode(bufferState) as VoxelQuad;

        return new Voxel(collisionLayerMask, quads);
    }
}

//------------------------------------------------------------------------------
// Each Voxel's Binary-Encoded Format:
//------------------------------------------------------------------------------
//
// Layout: [Voxel Byte][Quad Byte 1][Quad Byte 2][Quad Byte 1][Quad Byte 2][Quad Byte 1][Quad Byte 2]...
//
// [Voxel Byte]:
//     4 bits for the voxel's collisionLayerMask
//     4 bits for the number of quads in the voxel's mesh
//         (binary range of [0000:1111] corresponds to the numerical range of [1:16])
//
// [Quad Byte 1]:
//     2 bits for the axis that the quad is facing
//         (00 => x-axis, 01 => y-axis, 10 => z-axis)
//     1 bit for whether the quad is facing the (-) or (+) direction of the axis
//         (0 => (-), 1 => (+))
//     3 bits for the y-offset of the quad's center position
//         (000 => 0.0, 001 => 0.5, 010 => 1.0, 011 => 1.5, 100 => 2.0, 101 => 2.5, 110 => 3.0, 111 => 3.5)
//     2 bits left unused for now
//
// [Quad Byte 2]:
//     6 bits for the quad's texture index
//     2 bits left unused for now
//------------------------------------------------------------------------------