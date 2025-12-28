import ObjectTypeConfigMap from "../object/maps/objectTypeConfigMap";
import PersistentObject from "../object/types/persistentObject";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN } from "../physics/types/collisionLayer";
import Voxel from "../voxel/types/voxel";
import VoxelGrid from "../voxel/types/voxelGrid";
import { setAndShowVoxelQuadTexture } from "../voxel/util/voxelQuadUpdateUtil";

const minRoomNumber = 0;
const maxRoomNumber = 3;

const RoomGenerator =
{
    generateRoom: async (roomID: string): Promise<{voxelGrid: VoxelGrid, persistentObjects: PersistentObject[]}> =>
    {
        const numGridRows = 32;
        const numGridCols = 32;
        const roomNumber = parseInt(roomID.substring(1));
        const floorAndCeilingTextureIndex = 8 * roomNumber;
        const wallTextureIndex = 8 * roomNumber + 1;

        const voxels = new Array<Voxel>(numGridRows * numGridCols);

        // Initialize corner voxels
        voxels[0] = new Voxel(0b00000000, new Uint8Array(2).fill(0b00000000));
        voxels[numGridCols-1] = new Voxel(0b00000000, new Uint8Array(2).fill(0b00000000));
        voxels[(numGridRows-1) * numGridCols] = new Voxel(0b00000000, new Uint8Array(2).fill(0b00000000));
        voxels[(numGridRows-1) * numGridCols + (numGridCols-1)] = new Voxel(0b00000000, new Uint8Array(2).fill(0b00000000));

        // Initialize floor and ceiling quads
        for (let row = 1; row < numGridRows-1; ++row)
        {
            for (let col = 1; col < numGridRows-1; ++col)
            {
                voxels[row * numGridCols + col] = new Voxel(0b00000000,
                    new Uint8Array(2).fill(0b10000000 + floorAndCeilingTextureIndex));
            }
        }
        
        // Initialize boundary wall quads
        for (let col = 1; col < numGridRows-1; ++col)
        {
            voxels[col] = new Voxel(0, new Uint8Array(2));
            voxels[(numGridRows-1) * numGridCols + col] = new Voxel(0, new Uint8Array(2));
            const voxelAtMinRow = voxels[col];
            const voxelAtMaxRow = voxels[(numGridRows-1) * numGridCols + col];
            voxelAtMinRow.quads = new Uint8Array(2).fill(0);
            voxelAtMaxRow.quads = new Uint8Array(2).fill(0);
            for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= COLLISION_LAYER_MAX; ++collisionLayer)
            {
                setAndShowVoxelQuadTexture(voxelAtMinRow, "z", "+", collisionLayer, wallTextureIndex, false);
                setAndShowVoxelQuadTexture(voxelAtMaxRow, "z", "-", collisionLayer, wallTextureIndex, false);
            }
        }
        for (let row = 1; row < numGridRows-1; ++row)
        {
            voxels[row * numGridCols] = new Voxel(0, new Uint8Array(2));
            voxels[row * numGridCols + numGridCols-1] = new Voxel(0, new Uint8Array(2));
            const voxelAtMinCol = voxels[row * numGridCols];
            const voxelAtMaxCol = voxels[row * numGridCols + numGridCols-1];
            voxelAtMinCol.quads = new Uint8Array(2).fill(0);
            voxelAtMaxCol.quads = new Uint8Array(2).fill(0);
            for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= COLLISION_LAYER_MAX; ++collisionLayer)
            {
                setAndShowVoxelQuadTexture(voxelAtMinCol, "x", "+", collisionLayer, wallTextureIndex, false);
                setAndShowVoxelQuadTexture(voxelAtMaxCol, "x", "-", collisionLayer, wallTextureIndex, false);
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
            voxelGrid: new VoxelGrid(numGridRows, numGridCols, voxels),
            persistentObjects,
        };
    },
}

export default RoomGenerator;