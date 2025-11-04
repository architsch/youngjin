import Voxel from "../types/voxel";
import VoxelGrid from "../types/voxelGrid";
import VoxelQuad from "../types/voxelQuad";

const VoxelGridEncoding =
{
    encode: (voxelGrid: VoxelGrid): ArrayBuffer =>
    {
        let numBytesRequired = 2;
        for (const voxel of voxelGrid.voxels)
            numBytesRequired += 1 + 2 * voxel.quads.length; // 1 Header Byte for each Voxel. 2 Quad Bytes for each Quad
        const bufferState = { view: new Uint8Array(numBytesRequired), index: 0 };

        bufferState.view[bufferState.index++] = voxelGrid.numGridRows;
        bufferState.view[bufferState.index++] = voxelGrid.numGridCols;
        for (const voxel of voxelGrid.voxels)
            encodeVoxel(voxel, voxelGrid, bufferState);

        const buffer = bufferState.view.buffer;
        return buffer;
    },
    decode: (encodedVoxelGrid: ArrayBuffer): VoxelGrid =>
    {
        const bufferState = { view: new Uint8Array(encodedVoxelGrid), index: 0 };
        
        const numGridRows = bufferState.view[bufferState.index++];
        const numGridCols = bufferState.view[bufferState.index++];
        const numVoxels = numGridRows * numGridCols;
        const voxels = new Array<Voxel>(numVoxels);
        voxels.length = 0;

        const numGridColsInv = 1 / numGridCols;
        let voxelIndex = 0;

        while (bufferState.index < bufferState.view.length)
        {
            if (voxelIndex >= numVoxels)
                throw new Error(`Voxel index exceeded the supposed number of voxels (voxelIndex = ${voxelIndex}, numVoxels = ${numVoxels})`);
            const row = Math.floor(voxelIndex * numGridColsInv);
            const col = voxelIndex % numGridCols;
            if (row < 0 || col < 0 || row >= numGridRows || col >= numGridCols)
                throw new Error(`Decoded voxel coordinates are out of range (row = ${row}, col = ${col}, numGridRows = ${numGridRows}, numGridCols = ${numGridCols})`);
            voxels[voxelIndex++] = decodeVoxel(row, col, bufferState);
        }
        return { numGridRows, numGridCols, voxels };
    },
}

function encodeVoxel(voxel: Voxel, voxelGrid: VoxelGrid, bufferState: { view: Uint8Array, index: number })
{
    if (voxel.quads.length == 0)
        throw new Error(`Voxel has no quad in it (row = ${voxel.row}, col = ${voxel.col})`);
    if (voxel.quads.length > 16)
        throw new Error(`No more than 16 quads are allowed in a voxel (row = ${voxel.row}, col = ${voxel.col}, number of quads detected = ${voxel.quads.length})`);
    if (voxel.row < 0 || voxel.col < 0 || voxel.row >= voxelGrid.numGridRows || voxel.col >= voxelGrid.numGridCols)
        throw new Error(`Voxel's coordinates are out of range (row = ${voxel.row}, col = ${voxel.col}, numGridRows = ${voxelGrid.numGridRows}, numGridCols = ${voxelGrid.numGridCols})`);
    if (voxel.collisionLayerMask < 0 || voxel.collisionLayerMask > 0b1111)
        throw new Error(`Voxel's collisionLayerMask is out of its range (value found = ${voxel.collisionLayerMask}, range = [${0b0000}:${0b1111}])`);

    // Header Byte
    bufferState.view[bufferState.index++] =
        ((voxel.collisionLayerMask & 0b1111) << 4) |
        ((voxel.quads.length-1) & 0b1111);

    for (const quad of voxel.quads)
    {
        if (quad.textureIndex < 0 || quad.textureIndex > 63)
            throw new Error(`VoxelQuad's texture index is out of range (range = [0,63])`);

        // Quad Byte 1
        bufferState.view[bufferState.index++] =
            (((quad.facingAxis == "x") ? 0b00 : (quad.facingAxis == "y" ? 0b01 : 0b10)) << 6) |
            ((quad.orientation == "-" ? 0b0 : 0b1) << 5) |
            ((Math.round(quad.yOffset * 2) & 0b111) << 2);
        
        // Quad Byte 2
        bufferState.view[bufferState.index++] =
            ((quad.textureIndex & 0b111111) << 2);
    }
}

function decodeVoxel(row: number, col: number, bufferState: { view: Uint8Array, index: number }): Voxel
{
    // Header Byte
    const headerByte = bufferState.view[bufferState.index++];
    const collisionLayerMask = (headerByte >> 4) & 0b1111;
    const numQuads = (headerByte & 0b1111) + 1;

    const quads = new Array<VoxelQuad>(numQuads);
    for (let i = 0; i < numQuads; ++i)
    {
        // Quad Byte 1
        const quadByte1 = bufferState.view[bufferState.index++];
        const facingAxisRaw = (quadByte1 >> 6) & 0b11;
        const facingAxis = (facingAxisRaw == 0b00) ? "x" : (facingAxisRaw == 0b01 ? "y" : "z");
        const orientationRaw = (quadByte1 >> 5) & 0b1;
        const orientation = (orientationRaw == 0b0) ? "-" : "+";
        const yOffsetRaw = (quadByte1 >> 2) & 0b111;
        const yOffset = yOffsetRaw * 0.5;

        // Quad Byte 2
        const quadByte2 = bufferState.view[bufferState.index++];
        const textureIndex = (quadByte2 >> 2) & 0b111111;

        quads[i] = { facingAxis, orientation, yOffset, textureIndex };
    }

    return { row, col, collisionLayerMask, quads };
}

//------------------------------------------------------------------------------
// Each Voxel's Binary-Encoded Format:
//------------------------------------------------------------------------------
//
// Layout: [Header Byte][Quad Byte 1][Quad Byte 2][Quad Byte 1][Quad Byte 2][Quad Byte 1][Quad Byte 2]...
//
// [Header Byte]:
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

export default VoxelGridEncoding;