// A box of voxel blocks, by the rows, columns and collision layers it spans (each inclusive).
export default class RoomVolume
{
    rowMin: number;
    rowMax: number;
    colMin: number;
    colMax: number;
    collisionLayerMin: number;
    collisionLayerMax: number;

    constructor(rowMin: number, rowMax: number, colMin: number, colMax: number,
        collisionLayerMin: number, collisionLayerMax: number)
    {
        this.rowMin = rowMin;
        this.rowMax = rowMax;
        this.colMin = colMin;
        this.colMax = colMax;
        this.collisionLayerMin = collisionLayerMin;
        this.collisionLayerMax = collisionLayerMax;
    }
}
