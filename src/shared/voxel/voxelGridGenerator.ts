import Voxel from "./voxel";
import VoxelGrid from "./voxelGrid";
import VoxelQuad from "./voxelQuad";

type CollisionLayerMask = number;

const VoxelGridGenerator =
{
    generateEmptyRoom: (numGridRows: number, numGridCols: number,
        floorTextureIndex: number, wallTextureIndex: number): VoxelGrid =>
    {
        const voxels = new Array<Voxel>(numGridRows * numGridCols);
        for (let row = 0; row < numGridRows; ++row)
        {
            for (let col = 0; col < numGridCols; ++col)
            {
                if (row == 0)
                    makeWallVoxel(voxels, numGridCols, row, col, wallTextureIndex, "z", "+");
                else if (col == 0)
                    makeWallVoxel(voxels, numGridCols, row, col, wallTextureIndex, "x", "+");
                else if (row == numGridRows-1)
                    makeWallVoxel(voxels, numGridCols, row, col, wallTextureIndex, "z", "-");
                else if (col == numGridCols-1)
                    makeWallVoxel(voxels, numGridCols, row, col, wallTextureIndex, "x", "-");
                else
                    makeFloorVoxel(voxels, numGridCols, row, col, floorTextureIndex);
            }
        }
        makePillarVoxel(voxels, numGridCols, 3, 3, wallTextureIndex);
        makePillarVoxel(voxels, numGridCols, numGridRows-4, numGridCols-4, wallTextureIndex);
        makePillarVoxel(voxels, numGridCols, 3, numGridCols-4, wallTextureIndex);
        makePillarVoxel(voxels, numGridCols, numGridRows-4, 3, wallTextureIndex);
        return { numGridRows, numGridCols, voxels };
    },
}

//---------------------------------------------------------------------------
// Voxel Operations
//---------------------------------------------------------------------------

function makePillarVoxel(voxels: Voxel[], numGridCols: number, row: number, col: number,
    textureIndex: number)
{
    makeVoxel(voxels, numGridCols, row, col, [
        quads => addWallQuads("x", "+", textureIndex, quads),
        quads => addWallQuads("x", "-", textureIndex, quads),
        quads => addWallQuads("z", "+", textureIndex, quads),
        quads => addWallQuads("z", "-", textureIndex, quads),
    ]);
}

function makeFloorVoxel(voxels: Voxel[], numGridCols: number, row: number, col: number,
    textureIndex: number)
{
    makeVoxel(voxels, numGridCols, row, col, [
        quads => addFloorQuad(textureIndex, quads),
    ]);
}

function makeWallVoxel(voxels: Voxel[], numGridCols: number, row: number, col: number,
    textureIndex: number, facingAxis: "x" | "z", orientation: "-" | "+")
{
    makeVoxel(voxels, numGridCols, row, col, [
        quads => addWallQuads(facingAxis, orientation, textureIndex, quads),
    ]);
}

function makeVoxel(voxels: Voxel[], numGridCols: number, row: number, col: number,
    quadOperations: ((quads: VoxelQuad[]) => CollisionLayerMask)[])
{
    const quads: VoxelQuad[] = [];
    let collisionLayerMask = 0;
    for (const op of quadOperations)
        collisionLayerMask |= op(quads);
    voxels[row * numGridCols + col] = { row, col, collisionLayerMask, quads };
}

//---------------------------------------------------------------------------
// Quad Operations
//---------------------------------------------------------------------------

function addFloorQuad(textureIndex: number, quads: VoxelQuad[]): CollisionLayerMask
{
    quads.push({facingAxis: "y", orientation: "+", yOffset: 0, textureIndex});
    return 0b0000;
}

function addWallQuads(facingAxis: "x" | "y" | "z", orientation: "-" | "+",
    textureIndex: number, quads: VoxelQuad[]): CollisionLayerMask
{
    for (let yOffset = 0.5; yOffset <= 3.5; ++yOffset)
        quads.push({facingAxis, orientation, yOffset, textureIndex});
    return 0b0001;
}

export default VoxelGridGenerator;