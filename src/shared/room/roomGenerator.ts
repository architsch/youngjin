import PersistentObjectGroup from "../object/types/persistentObjectGroup";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, NUM_VOXEL_QUADS_PER_VOXEL } from "../system/constants";
import Voxel from "../voxel/types/voxel";
import VoxelGrid from "../voxel/types/voxelGrid";
import VoxelQuadsRuntimeMemory from "../voxel/types/voxelQuadsRuntimeMemory";
import { setVoxelQuadVisible } from "../voxel/util/voxelQuadUpdateUtil";
import { getFirstVoxelQuadIndexInLayer, getFirstVoxelQuadIndexInVoxel, getVoxelQuadIndexOffsetInsideLayer } from "../voxel/util/voxelQueryUtil";

const RoomGenerator =
{
    generateEmptyRoom: (
        floorTextureIndex: number, wallTextureIndex: number, ceilingTextureIndex: number
    ): {voxelGrid: VoxelGrid, persistentObjectGroup: PersistentObjectGroup} =>
    {
        const voxels = new Array<Voxel>(NUM_VOXEL_ROWS * NUM_VOXEL_COLS);
        const quadsMem = new VoxelQuadsRuntimeMemory();

        // Initialize corner voxels

        clearAllQuadsInVoxel(quadsMem.quads, getFirstVoxelQuadIndexInVoxel(0, 0));
        clearAllQuadsInVoxel(quadsMem.quads, getFirstVoxelQuadIndexInVoxel(0, NUM_VOXEL_COLS-1));
        clearAllQuadsInVoxel(quadsMem.quads, getFirstVoxelQuadIndexInVoxel(NUM_VOXEL_ROWS-1, 0));
        clearAllQuadsInVoxel(quadsMem.quads, getFirstVoxelQuadIndexInVoxel(NUM_VOXEL_ROWS-1, NUM_VOXEL_COLS-1));
        
        voxels[0] =
            new Voxel(quadsMem, 0, 0, 0b00000000);
        voxels[NUM_VOXEL_COLS-1] =
            new Voxel(quadsMem, 0, NUM_VOXEL_COLS-1, 0b00000000);
        voxels[(NUM_VOXEL_ROWS-1) * NUM_VOXEL_COLS] =
            new Voxel(quadsMem, NUM_VOXEL_ROWS-1, 0, 0b00000000);
        voxels[(NUM_VOXEL_ROWS-1) * NUM_VOXEL_COLS + (NUM_VOXEL_COLS-1)] =
            new Voxel(quadsMem, NUM_VOXEL_ROWS-1, NUM_VOXEL_COLS-1, 0b00000000);

        // Initialize floor and ceiling quads

        for (let row = 1; row < NUM_VOXEL_ROWS-1; ++row)
        {
            for (let col = 1; col < NUM_VOXEL_ROWS-1; ++col)
            {
                applyFloorAndCeilingTexture(quadsMem.quads, row, col, floorTextureIndex, ceilingTextureIndex);
                voxels[row * NUM_VOXEL_COLS + col] = new Voxel(quadsMem, row, col, 0b00000000);
            }
        }
        
        // Initialize boundary wall quads

        for (let col = 1; col < NUM_VOXEL_ROWS-1; ++col)
        {
            applyWallTexture(quadsMem.quads, 0, col, "z", "+", wallTextureIndex);
            applyWallTexture(quadsMem.quads, NUM_VOXEL_ROWS-1, col, "z", "-", wallTextureIndex);
            
            const lowerVoxel = new Voxel(quadsMem, 0, col, 0b11111111);
            voxels[col] = lowerVoxel;
            const upperVoxel = new Voxel(quadsMem, NUM_VOXEL_ROWS-1, col, 0b11111111);
            voxels[(NUM_VOXEL_ROWS-1) * NUM_VOXEL_COLS + col] = upperVoxel;
            for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= COLLISION_LAYER_MAX; ++collisionLayer)
            {
                setVoxelQuadVisible(true, lowerVoxel, "z", "+", collisionLayer, wallTextureIndex);
                setVoxelQuadVisible(true, upperVoxel, "z", "-", collisionLayer, wallTextureIndex);
            }
        }
        for (let row = 1; row < NUM_VOXEL_ROWS-1; ++row)
        {
            applyWallTexture(quadsMem.quads, row, 0, "x", "+", wallTextureIndex);
            applyWallTexture(quadsMem.quads, row, NUM_VOXEL_COLS-1, "x", "-", wallTextureIndex);
            
            const lowerVoxel = new Voxel(quadsMem, row, 0, 0b11111111);
            voxels[row * NUM_VOXEL_COLS] = lowerVoxel
            const upperVoxel = new Voxel(quadsMem, row, NUM_VOXEL_COLS-1, 0b11111111);
            voxels[row * NUM_VOXEL_COLS + NUM_VOXEL_COLS-1] = upperVoxel;
            for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= COLLISION_LAYER_MAX; ++collisionLayer)
            {
                setVoxelQuadVisible(true, lowerVoxel, "x", "+", collisionLayer, wallTextureIndex);
                setVoxelQuadVisible(true, upperVoxel, "x", "-", collisionLayer, wallTextureIndex);
            }
        }

        return {
            voxelGrid: new VoxelGrid(voxels, quadsMem),
            persistentObjectGroup: new PersistentObjectGroup([]),
        };
    },
}

function applyFloorAndCeilingTexture(quads: Uint8Array, row: number, col: number,
    floorTextureIndex: number, ceilingTextureIndex: number)
{
    const startIndex = getFirstVoxelQuadIndexInVoxel(row, col);
    clearAllQuadsInVoxel(quads, startIndex);
    quads[startIndex + NUM_VOXEL_QUADS_PER_VOXEL-2] = 0b10000000 | ceilingTextureIndex;
    quads[startIndex + NUM_VOXEL_QUADS_PER_VOXEL-1] = 0b10000000 | floorTextureIndex;
}

function applyWallTexture(quads: Uint8Array, row: number, col: number,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+", wallTextureIndex: number)
{
    const startIndex = getFirstVoxelQuadIndexInVoxel(row, col);
    clearAllQuadsInVoxel(quads, startIndex);
    for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= COLLISION_LAYER_MAX; ++collisionLayer)
    {
        const startIndex = getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
        const offset = getVoxelQuadIndexOffsetInsideLayer(facingAxis, orientation);
        quads[startIndex + offset] = 0b10000000 | wallTextureIndex;
    }
}

function clearAllQuadsInVoxel(quads: Uint8Array, startIndex: number)
{
    for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_VOXEL; ++i)
        quads[i] = 0b00000000;
}

export default RoomGenerator;