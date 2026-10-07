import { VOXEL_BLOCK_SHAPE_EMPTY, VOXEL_BLOCK_SHAPE_WHOLE } from "../../system/sharedConstants";
import VoxelBlockBounds from "../types/voxelBlockBounds";

const NUM_SHAPE_VALUES = VOXEL_BLOCK_SHAPE_WHOLE + 1;
const WHOLE_BOUNDS: VoxelBlockBounds = {minX: 0, maxX: 1, minZ: 0, maxZ: 1};

// The bit of a stored quad byte its texture index leaves spare, and where the side quads start among a
// block's six (see NUM_VOXEL_QUADS_PER_COLLISION_LAYER).
const QUAD_SPARE_BIT = 0b10000000;
const FIRST_SIDE_QUAD_OFFSET = 2;

// Indexed by shape; undefined where the bits are not a rectangle (a diagonal or an L), or are none.
const boundsByShape: (VoxelBlockBounds | undefined)[] = [];
for (let shape = 0; shape < NUM_SHAPE_VALUES; ++shape)
    boundsByShape.push(findRectangle(shape));

// Block shapes (see VOXEL_BLOCK_SHAPE_EMPTY): the empty one, the whole one, four halves and four quarters.
const VoxelBlockShapeUtil =
{
    isValid(shape: number): boolean
    {
        return shape === VOXEL_BLOCK_SHAPE_EMPTY ||
            (Number.isInteger(shape) && shape > 0 && shape < NUM_SHAPE_VALUES && boundsByShape[shape] != undefined);
    },

    // The box of a block of this shape. The whole cell for the empty shape, which is where a block
    // there would go. The object returned is shared, so it must not be changed.
    getBounds(shape: number): VoxelBlockBounds
    {
        return boundsByShape[shape] ?? WHOLE_BOUNDS;
    },

    // How much of one side of its cell the shape reaches. Along y that is the shape itself. Along x or
    // z it is two bits, one per half of that side across (bit 0 the lower half): none set means the
    // shape stops short of the side.
    getSideMask(shape: number, facingAxis: "x" | "y" | "z", orientation: "-" | "+"): number
    {
        if (facingAxis == "y")
            return shape;
        if (facingAxis == "x")
        {
            const firstBit = (orientation == "-") ? 0 : 1;
            return ((shape >> firstBit) & 1) | (((shape >> (firstBit + 2)) & 1) << 1);
        }
        return (orientation == "-") ? (shape & 0b11) : ((shape >> 2) & 0b11);
    },

    // Whether a block of this shape draws its face on one side, given the shape of the block that face
    // looks at.
    showsFace(shape: number, facedShape: number, facingAxis: "x" | "y" | "z", orientation: "-" | "+"): boolean
    {
        return shape != VOXEL_BLOCK_SHAPE_EMPTY && VoxelBlockShapeUtil.isSideBare(
            VoxelBlockShapeUtil.getSideMask(shape, facingAxis, orientation),
            VoxelBlockShapeUtil.getSideMask(facedShape, facingAxis, (orientation == "+") ? "-" : "+"));
    },

    // The rule behind showsFace, by side masks (see getSideMask): a face that stops short of its cell's
    // side has nothing to cover it, and one that reaches the side is bare unless the side it looks at
    // covers all of it.
    isSideBare(sideMask: number, facedSideMask: number): boolean
    {
        return sideMask == 0 || (sideMask & ~facedSideMask) != 0;
    },

    // Whether two shapes have the same face on one side: in the same place, and the same size.
    facesMatch(shapeA: number, shapeB: number, facingAxis: "x" | "y" | "z", orientation: "-" | "+"): boolean
    {
        if (shapeA == shapeB)
            return true;
        if (facingAxis == "y")
            return false; // A top or bottom face is the shape itself.
        const a = VoxelBlockShapeUtil.getBounds(shapeA), b = VoxelBlockShapeUtil.getBounds(shapeB);
        if (facingAxis == "x")
        {
            return ((orientation == "+") ? (a.maxX == b.maxX) : (a.minX == b.minX))
                && a.minZ == b.minZ && a.maxZ == b.maxZ;
        }
        return ((orientation == "+") ? (a.maxZ == b.maxZ) : (a.minZ == b.minZ))
            && a.minX == b.minX && a.maxX == b.maxX;
    },

    // Whether the shape fills the sub-block holding a point of its cell (x and z from 0 to 1 across it).
    containsPoint(shape: number, cellX: number, cellZ: number): boolean
    {
        const subBlock = ((cellX >= 0.5) ? 1 : 0) + ((cellZ >= 0.5) ? 2 : 0);
        return (shape & (1 << subBlock)) != 0;
    },

    // The shape spread over both halves of its cell along x or z, as wide the other way as it was. Along
    // y a shape always spans its layer, so it is returned as it is.
    stretchAlong(shape: number, axis: "x" | "y" | "z"): number
    {
        if (axis == "x")
            return shape | ((shape & 0b0101) << 1) | ((shape & 0b1010) >> 1);
        if (axis == "z")
            return shape | ((shape & 0b0011) << 2) | ((shape & 0b1100) >> 2);
        return shape;
    },

    // What a shape has in one half of its cell along x or z; the empty shape if it stops short of it.
    getHalf(shape: number, axis: "x" | "z", orientation: "-" | "+"): number
    {
        if (axis == "x")
            return shape & ((orientation == "-") ? 0b0101 : 0b1010);
        return shape & ((orientation == "-") ? 0b0011 : 0b1100);
    },

    // A shape's bound on one side along x or z lies either at that side of its cell or in mid-cell.
    isBoundInMidCell(shape: number, axis: "x" | "z", orientation: "-" | "+"): boolean
    {
        return VoxelBlockShapeUtil.getHalf(shape, axis, orientation) == VOXEL_BLOCK_SHAPE_EMPTY;
    },

    // The shape with its bound on one side along x or z put in mid-cell or at that side of the cell, and
    // the bound across from it left where it is. The empty shape where nothing would be left between them.
    moveBound(shape: number, axis: "x" | "z", orientation: "-" | "+", toMidCell: boolean): number
    {
        if (VoxelBlockShapeUtil.isBoundInMidCell(shape, axis, orientation) == toMidCell)
            return shape;
        return toMidCell
            ? VoxelBlockShapeUtil.getHalf(shape, axis, (orientation == "+") ? "-" : "+")
            : VoxelBlockShapeUtil.stretchAlong(shape, axis);
    },

    // A block's shape is stored in the spare bit of its four side quads' bytes (see Voxel), one sub-block
    // each, set where the sub-block is cut away. So bytes written before blocks had shapes, whose spare
    // bits are all clear, read as whole blocks.

    // The spare bit one of a block's six quad bytes is stored with, for the block's shape.
    getStoredQuadBit(shape: number, quadIndexOffsetInsideLayer: number): number
    {
        const subBlock = quadIndexOffsetInsideLayer - FIRST_SIDE_QUAD_OFFSET;
        return (subBlock >= 0 && (shape & (1 << subBlock)) == 0) ? QUAD_SPARE_BIT : 0;
    },

    // The shape a block's six stored quad bytes spell, which need not be a valid one.
    getStoredShape(storedQuads: ArrayLike<number>, firstQuadByteIndex: number): number
    {
        let shape = VOXEL_BLOCK_SHAPE_EMPTY;
        for (let subBlock = 0; subBlock < 4; ++subBlock)
        {
            if ((storedQuads[firstQuadByteIndex + FIRST_SIDE_QUAD_OFFSET + subBlock] & QUAD_SPARE_BIT) == 0)
                shape |= (1 << subBlock);
        }
        return shape;
    },
};

function findRectangle(shape: number): VoxelBlockBounds | undefined
{
    let minX = 2, maxX = -1, minZ = 2, maxZ = -1, numSubBlocks = 0;
    for (let subBlock = 0; subBlock < 4; ++subBlock)
    {
        if ((shape & (1 << subBlock)) == 0)
            continue;
        const x = subBlock & 1, z = subBlock >> 1;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
        ++numSubBlocks;
    }
    if (numSubBlocks == 0 || numSubBlocks != (maxX - minX + 1) * (maxZ - minZ + 1))
        return undefined;
    return {minX: 0.5 * minX, maxX: 0.5 * (maxX + 1), minZ: 0.5 * minZ, maxZ: 0.5 * (maxZ + 1)};
}

export default VoxelBlockShapeUtil;
