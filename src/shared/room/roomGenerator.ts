import ObjectTypeConfigMap from "../object/maps/objectTypeConfigMap";
import PersistentObject from "../object/types/persistentObject";
import { COLLISION_LAYER_UNBREAKABLE } from "../physics/types/collisionLayer";
import Voxel from "../voxel/types/voxel";
import VoxelGrid from "../voxel/types/voxelGrid";
import VoxelQuad from "../voxel/types/voxelQuad";

type CollisionLayerMask = number;

const minRoomNumber = 0;
const maxRoomNumber = 3;

const RoomGenerator =
{
    generateRoom: (roomID: string) : {voxelGrid: VoxelGrid, persistentObjects: PersistentObject[]} =>
    {
        const numGridRows = 32;
        const numGridCols = 32;
        const roomNumber = parseInt(roomID.substring(1));
        const floorTextureIndex = 8 * roomNumber;
        const wallTextureIndex = 8 * roomNumber + 1;

        const voxels = new Array<Voxel>(numGridRows * numGridCols);
        for (let row = 0; row < numGridRows; ++row)
        {
            for (let col = 0; col < numGridCols; ++col)
            {
                if (row == 0)
                    makeWallVoxel(voxels, numGridRows, numGridCols, row, col, wallTextureIndex, "z", "+");
                else if (col == 0)
                    makeWallVoxel(voxels, numGridRows, numGridCols, row, col, wallTextureIndex, "x", "+");
                else if (row == numGridRows-1)
                    makeWallVoxel(voxels, numGridRows, numGridCols, row, col, wallTextureIndex, "z", "-");
                else if (col == numGridCols-1)
                    makeWallVoxel(voxels, numGridRows, numGridCols, row, col, wallTextureIndex, "x", "-");
                else
                    makeFloorVoxel(voxels, numGridRows, numGridCols, row, col, floorTextureIndex);
            }
        }
        makePillarVoxel(voxels, numGridRows, numGridCols, 3, 3, wallTextureIndex);
        makePillarVoxel(voxels, numGridRows, numGridCols, numGridRows-4, numGridCols-4, wallTextureIndex);
        makePillarVoxel(voxels, numGridRows, numGridCols, 3, numGridCols-4, wallTextureIndex);
        makePillarVoxel(voxels, numGridRows, numGridCols, numGridRows-4, 3, wallTextureIndex);

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

                //makePillarVoxel(voxels, numGridCols, z+1, x, wallTextureIndex);
            }
        }
        
        return {
            voxelGrid: new VoxelGrid(numGridRows, numGridCols, voxels),
            persistentObjects,
        };
    },
}

//---------------------------------------------------------------------------
// Voxel Operations
//---------------------------------------------------------------------------

function makePillarVoxel(voxels: Voxel[], numGridRows: number, numGridCols: number, row: number, col: number,
    textureIndex: number): Voxel
{
    return makeVoxel(voxels, numGridRows, numGridCols, row, col, [
        quads => addWallQuads("x", "+", textureIndex, quads),
        quads => addWallQuads("x", "-", textureIndex, quads),
        quads => addWallQuads("z", "+", textureIndex, quads),
        quads => addWallQuads("z", "-", textureIndex, quads),
    ]);
}

function makeFloorVoxel(voxels: Voxel[], numGridRows: number, numGridCols: number, row: number, col: number,
    textureIndex: number): Voxel
{
    return makeVoxel(voxels, numGridRows, numGridCols, row, col, [
        quads => addFloorQuad(textureIndex, quads),
    ]);
}

function makeWallVoxel(voxels: Voxel[], numGridRows: number, numGridCols: number, row: number, col: number,
    textureIndex: number, facingAxis: "x" | "z", orientation: "-" | "+"): Voxel
{
    const voxel = makeVoxel(voxels, numGridRows, numGridCols, row, col, [
        quads => addWallQuads(facingAxis, orientation, textureIndex, quads),
    ]);
    if (row == 0 || row == numGridRows-1 || col == 0 || col == numGridCols-1)
        voxel.collisionLayerMask |= (1 << COLLISION_LAYER_UNBREAKABLE); // Boundary voxels are unbreakable
    return voxel;
}

function makeVoxel(voxels: Voxel[], numGridRows: number, numGridCols: number, row: number, col: number,
    quadOperations: ((quads: VoxelQuad[]) => CollisionLayerMask)[]): Voxel
{
    const quads: VoxelQuad[] = [];
    let collisionLayerMask = 0;
    for (const op of quadOperations)
        collisionLayerMask |= op(quads);
    const voxel = new Voxel(collisionLayerMask, quads);
    voxel.setCoordinates(row, col);
    voxels[row * numGridCols + col] = voxel;
    return voxel;
}

//---------------------------------------------------------------------------
// VoxelQuad Operations
//---------------------------------------------------------------------------

function addFloorQuad(textureIndex: number, quads: VoxelQuad[]): CollisionLayerMask
{
    quads.push(new VoxelQuad("y", "+", 0, textureIndex));
    return 0b0000;
}

function addWallQuads(facingAxis: "x" | "y" | "z", orientation: "-" | "+",
    textureIndex: number, quads: VoxelQuad[]): CollisionLayerMask
{
    for (let yOffset = 0.5; yOffset <= 3.5; ++yOffset)
        quads.push(new VoxelQuad(facingAxis, orientation, yOffset, textureIndex));
    return 0b0001;
}

//---------------------------------------------------------------------------
// PersistentObject Operations
//---------------------------------------------------------------------------

export default RoomGenerator;