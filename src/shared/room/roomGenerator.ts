import ObjectTypeConfigMap from "../object/maps/objectTypeConfigMap";
import PersistentObject from "../object/types/persistentObject";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_GRID_COLS, NUM_GRID_ROWS, NUM_VOXEL_QUADS_PER_VOXEL } from "../system/constants";
import Voxel, { voxelQuadsBuffer } from "../voxel/types/voxel";
import VoxelGrid from "../voxel/types/voxelGrid";
import { showVoxelQuad } from "../voxel/util/voxelQuadUpdateUtil";
import { getFirstVoxelQuadIndexInLayer, getFirstVoxelQuadIndexInVoxel, getVoxelQuadIndexOffsetInsideLayer } from "../voxel/util/voxelQueryUtil";

const minRoomNumber = 0;
const maxRoomNumber = 3;

const RoomGenerator =
{
    generateRoom: async (roomID: string): Promise<{voxelGrid: VoxelGrid, persistentObjects: PersistentObject[]}> =>
    {
        const roomNumber = parseInt(roomID.substring(1));
        const floorTextureIndex = 8 * roomNumber;
        const wallTextureIndex = 8 * roomNumber + 1;
        const ceilingTextureIndex = 8 * roomNumber + 2;

        const voxels = new Array<Voxel>(NUM_GRID_ROWS * NUM_GRID_COLS);

        // Initialize corner voxels
        clearAllQuadsInVoxel(getFirstVoxelQuadIndexInVoxel(0, 0));
        clearAllQuadsInVoxel(getFirstVoxelQuadIndexInVoxel(0, NUM_GRID_COLS-1));
        clearAllQuadsInVoxel(getFirstVoxelQuadIndexInVoxel(NUM_GRID_ROWS-1, 0));
        clearAllQuadsInVoxel(getFirstVoxelQuadIndexInVoxel(NUM_GRID_ROWS-1, NUM_GRID_COLS-1));
        voxels[0] = new Voxel(0, 0, 0b00000000);
        voxels[NUM_GRID_COLS-1] = new Voxel(0, NUM_GRID_COLS-1, 0b00000000);
        voxels[(NUM_GRID_ROWS-1) * NUM_GRID_COLS] = new Voxel(NUM_GRID_ROWS-1, 0, 0b00000000);
        voxels[(NUM_GRID_ROWS-1) * NUM_GRID_COLS + (NUM_GRID_COLS-1)] = new Voxel(NUM_GRID_ROWS-1, NUM_GRID_COLS-1, 0b00000000);

        // Initialize floor and ceiling quads
        for (let row = 1; row < NUM_GRID_ROWS-1; ++row)
        {
            for (let col = 1; col < NUM_GRID_ROWS-1; ++col)
            {
                applyFloorAndCeilingTexture(row, col, floorTextureIndex, ceilingTextureIndex);
                voxels[row * NUM_GRID_COLS + col] = new Voxel(row, col, 0b00000000);
            }
        }
        
        // Initialize boundary wall quads
        for (let col = 1; col < NUM_GRID_ROWS-1; ++col)
        {
            applyWallTexture(0, col, "z", "+", wallTextureIndex);
            applyWallTexture(NUM_GRID_ROWS-1, col, "z", "-", wallTextureIndex);
            
            const lowerVoxel = new Voxel(0, col, 0b11111111);
            voxels[col] = lowerVoxel;
            const upperVoxel = new Voxel(NUM_GRID_ROWS-1, col, 0b11111111);
            voxels[(NUM_GRID_ROWS-1) * NUM_GRID_COLS + col] = upperVoxel;
            for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= COLLISION_LAYER_MAX; ++collisionLayer)
            {
                showVoxelQuad(lowerVoxel, "z", "+", collisionLayer, wallTextureIndex, false);
                showVoxelQuad(upperVoxel, "z", "-", collisionLayer, wallTextureIndex, false);
            }
        }
        for (let row = 1; row < NUM_GRID_ROWS-1; ++row)
        {
            applyWallTexture(row, 0, "x", "+", wallTextureIndex);
            applyWallTexture(row, NUM_GRID_COLS-1, "x", "-", wallTextureIndex);
            
            const lowerVoxel = new Voxel(row, 0, 0b11111111);
            voxels[row * NUM_GRID_COLS] = lowerVoxel
            const upperVoxel = new Voxel(row, NUM_GRID_COLS-1, 0b11111111);
            voxels[row * NUM_GRID_COLS + NUM_GRID_COLS-1] = upperVoxel;
            for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= COLLISION_LAYER_MAX; ++collisionLayer)
            {
                showVoxelQuad(lowerVoxel, "x", "+", collisionLayer, wallTextureIndex, false);
                showVoxelQuad(upperVoxel, "x", "-", collisionLayer, wallTextureIndex, false);
            }
        }

        const persistentObjects: PersistentObject[] = [];

        let shift = 12;
        for (let roomNumber = minRoomNumber; roomNumber <= maxRoomNumber; ++roomNumber)
        {
            const otherRoomID = `s${roomNumber}`;

            if (otherRoomID != roomID)
            {
                const x = shift;
                const y = 2;
                const z = 1;
                shift += 4;
                const objectId = `p${x}-${y}-${z}`;

                persistentObjects.push(new PersistentObject(
                    objectId,
                    ObjectTypeConfigMap.getIndexByType("Door"),
                    "+z",
                    x, y, z,
                    otherRoomID
                ));
            }
        }
        
        return {
            voxelGrid: new VoxelGrid(voxels),
            persistentObjects,
        };
    },
}

function applyFloorAndCeilingTexture(row: number, col: number,
    floorTextureIndex: number, ceilingTextureIndex: number)
{
    const startIndex = getFirstVoxelQuadIndexInVoxel(row, col);
    clearAllQuadsInVoxel(startIndex);
    voxelQuadsBuffer[startIndex + NUM_VOXEL_QUADS_PER_VOXEL-2] = 0b10000000 | ceilingTextureIndex;
    voxelQuadsBuffer[startIndex + NUM_VOXEL_QUADS_PER_VOXEL-1] = 0b10000000 | floorTextureIndex;
}

function applyWallTexture(row: number, col: number, facingAxis: "x" | "y" | "z", orientation: "-" | "+",
    wallTextureIndex: number)
{
    const startIndex = getFirstVoxelQuadIndexInVoxel(row, col);
    clearAllQuadsInVoxel(startIndex);
    for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= COLLISION_LAYER_MAX; ++collisionLayer)
    {
        const startIndex = getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
        const offset = getVoxelQuadIndexOffsetInsideLayer(facingAxis, orientation);
        voxelQuadsBuffer[startIndex + offset] = 0b10000000 | wallTextureIndex;
    }
}

function clearAllQuadsInVoxel(startIndex: number)
{
    for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_VOXEL; ++i)
        voxelQuadsBuffer[i] = 0b00000000;
}

export default RoomGenerator;