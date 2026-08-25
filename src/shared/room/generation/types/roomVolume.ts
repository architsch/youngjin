import RoomPalette from "./roomPalette";

// RoomVolume represents a 3D box-shaped interior space of a room. I am saying "interior" here
// because RoomVolume's row, col, and collisionLayer ranges are not supposed to include
// the surrounding floor-blocks, wall-blocks, and ceiling-blocks; they only span the inner (empty) space of
// the 3D region, excluding the solid parts of its boundaries (i.e. floor, walls, ceiling).
// (Note: There are cases, however, where a RoomVolume may simply represent
// a region in space, without any association with the room's interior - for purely semantic purposes.)
export default class RoomVolume
{
    rowMin: number;
    rowMax: number;
    colMin: number;
    colMax: number;
    collisionLayerMin: number;
    collisionLayerMax: number;
    palette: RoomPalette | undefined;

    constructor(rowMin: number, rowMax: number, colMin: number, colMax: number,
        collisionLayerMin: number, collisionLayerMax: number,
        palette: RoomPalette | undefined = undefined)
    {
        this.rowMin = rowMin;
        this.rowMax = rowMax;
        this.colMin = colMin;
        this.colMax = colMax;
        this.collisionLayerMin = collisionLayerMin;
        this.collisionLayerMax = collisionLayerMax;
        this.palette = palette;
    }
}