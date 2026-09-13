import RoomPalette from "./roomPalette";

// A box-shaped interior space (excluding its enclosing floor, walls and ceiling). Sometimes used just to
// name a region.
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