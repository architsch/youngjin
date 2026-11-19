import BufferState from "../../networking/types/bufferState";

// A restricted zone as the grid held one up to format version 7 (see VoxelGridVersionMigration): a rectangle
// of the grid, from the room's floor to its ceiling, that only the room's superuser could edit. Zones are
// volumes now, kept with the room's objects (see ObjectGroupVersionMigration).
export default class LegacyRestrictedZone
{
    rowMin: number;
    rowMax: number;
    colMin: number;
    colMax: number;

    constructor(rowMin: number, rowMax: number, colMin: number, colMax: number)
    {
        this.rowMin = rowMin;
        this.rowMax = rowMax;
        this.colMin = colMin;
        this.colMax = colMax;
    }

    // A byte each, in the order of the fields.
    static decode(bufferState: BufferState): LegacyRestrictedZone
    {
        const rowMin = bufferState.view[bufferState.byteIndex++];
        const rowMax = bufferState.view[bufferState.byteIndex++];
        const colMin = bufferState.view[bufferState.byteIndex++];
        const colMax = bufferState.view[bufferState.byteIndex++];
        return new LegacyRestrictedZone(rowMin, rowMax, colMin, colMax);
    }
}
