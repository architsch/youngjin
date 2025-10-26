import Voxel from "./voxel";
import VoxelGrid from "./voxelGrid";
import VoxelQuad from "./voxelQuad";

const unicodeShiftFactor = 0;

let buffer = new Uint8Array(32768);
let currBufferIndex = 0;

const VoxelGridEncoding =
{
    encode: (voxelGrid: VoxelGrid): string =>
    {
        currBufferIndex = 0;
        buffer[currBufferIndex++] = voxelGrid.numGridRows;
        buffer[currBufferIndex++] = voxelGrid.numGridCols;
        for (const voxel of voxelGrid.voxels)
            encodeVoxel(voxel, voxelGrid);

        const bufferLength = currBufferIndex;
        const charArray = new Array<string>(bufferLength);
        for (let i = 0; i < bufferLength; ++i)
        {
            charArray[i] = String.fromCharCode(buffer[i] + unicodeShiftFactor);
        }
        return charArray.join("");
    },
    decode: (encodedVoxelGrid: string): VoxelGrid =>
    {
        currBufferIndex = 0;
        for (let i = 0; i < encodedVoxelGrid.length; ++i)
        {
            const charCode = encodedVoxelGrid.charCodeAt(i);
            buffer[currBufferIndex++] = charCode - unicodeShiftFactor;
        }
        
        const bufferLength = currBufferIndex;
        currBufferIndex = 0;
        
        const numGridRows = buffer[currBufferIndex++];
        const numGridCols = buffer[currBufferIndex++];
        const voxels = new Array<Voxel>(numGridRows * numGridCols);
        voxels.length = 0;

        const numGridColsInv = 1 / numGridCols;
        let voxelIndex = 0;

        while (currBufferIndex < bufferLength)
        {
            const row = Math.floor(voxelIndex * numGridColsInv);
            const col = voxelIndex % numGridCols;
            voxels.push(decodeVoxel(row, col));
            ++voxelIndex;
        }
        return { numGridRows, numGridCols, voxels };
    },
}

function encodeVoxel(voxel: Voxel, voxelGrid: VoxelGrid)
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
    buffer[currBufferIndex++] =
        ((voxel.collisionLayerMask & 0b1111) << 4) |
        ((voxel.quads.length-1) & 0b1111);

    for (const quad of voxel.quads)
    {
        if (quad.textureIndex < 0 || quad.textureIndex > 63)
            throw new Error(`VoxelQuad's texture index is out of range (range = [0,63])`);

        // Quad Byte 1
        buffer[currBufferIndex++] =
            (((quad.facingAxis == "x") ? 0b00 : (quad.facingAxis == "y" ? 0b01 : 0b10)) << 6) |
            ((quad.orientation == "-" ? 0b0 : 0b1) << 5) |
            ((Math.round(quad.yOffset * 2) & 0b111) << 2);
        
        // Quad Byte 2
        buffer[currBufferIndex++] =
            ((quad.textureIndex & 0b111111) << 2);
    }
}

function decodeVoxel(row: number, col: number): Voxel
{
    // Header Byte
    const headerByte = buffer[currBufferIndex++];
    const collisionLayerMask = (headerByte >> 4) & 0b1111;
    const numQuads = (headerByte & 0b1111) + 1;

    const quads = new Array<VoxelQuad>(numQuads);
    for (let i = 0; i < numQuads; ++i)
    {
        // Quad Byte 1
        const quadByte1 = buffer[currBufferIndex++];
        const facingAxisRaw = (quadByte1 >> 6) & 0b11;
        const facingAxis = (facingAxisRaw == 0b00) ? "x" : (facingAxisRaw == 0b01 ? "y" : "z");
        const orientationRaw = (quadByte1 >> 5) & 0b1;
        const orientation = (orientationRaw == 0b0) ? "-" : "+";
        const yOffsetRaw = (quadByte1 >> 2) & 0b111;
        const yOffset = yOffsetRaw * 0.5;

        // Quad Byte 2
        const quadByte2 = buffer[currBufferIndex++];
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
// (Header Byte):
//     4 bits for the voxel's collisionLayerMask
//     4 bits for the number of quads in the voxel's mesh
//         (binary range of [0000:1111] corresponds to the numerical range of [1:16])
//
// (Quad Byte 1):
//     2 bits for the axis that the quad is facing
//         (00 => x-axis, 01 => y-axis, 10 => z-axis)
//     1 bit for whether the quad is facing the (-) or (+) direction of the axis
//         (0 => (-), 1 => (+))
//     3 bits for the y-offset of the quad's center position
//         (000 => 0.0, 001 => 0.5, 010 => 1.0, 011 => 1.5, 100 => 2.0, 101 => 2.5, 110 => 3.0, 111 => 3.5)
//     2 bits left unused for now
//
// (Quad Byte 2):
//     6 bits for the quad's texture index
//     2 bits left unused for now
//------------------------------------------------------------------------------

export default VoxelGridEncoding;