export default class RoomVolumeRangeIntersections
{
    rowRangeIntersection: [number, number] | null;
    colRangeIntersection: [number, number] | null;
    collisionLayerRangeIntersection: [number, number] | null;

    constructor(rowRangeIntersection: [number, number] | null,
        colRangeIntersection: [number, number] | null,
        collisionLayerRangeIntersection: [number, number] | null)
    {
        this.rowRangeIntersection = rowRangeIntersection;
        this.colRangeIntersection = colRangeIntersection;
        this.collisionLayerRangeIntersection = collisionLayerRangeIntersection;
    }
}