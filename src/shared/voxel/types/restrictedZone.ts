import AABB3 from "../../math/types/aabb3";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import { MAX_ROOM_Y } from "../../system/sharedConstants";

// A rectangle only the superuser may edit (see @docs/gameplay/restricted_zone.md). Rows and columns only,
// since it always spans the full room height (a partial zone would leave the wall above unprotected).
export default class RestrictedZone extends EncodableData
{
    rowMin: number;
    rowMax: number;
    colMin: number;
    colMax: number;

    constructor(rowMin: number, rowMax: number, colMin: number, colMax: number)
    {
        super();
        this.rowMin = rowMin;
        this.rowMax = rowMax;
        this.colMin = colMin;
        this.colMax = colMax;
    }

    // Test volume. Both margins matter because the overlap tests are strict (a point on a face is outside).
    getVolume(): AABB3
    {
        return {
            center: {
                x: 0.5 * (this.colMax + this.colMin + 1),
                y: 0.5 * MAX_ROOM_Y,
                z: 0.5 * (this.rowMax + this.rowMin + 1),
            },
            halfSize: {
                // Inset horizontally, so the zone's outermost faces stay paintable.
                x: 0.5 * (this.colMax - this.colMin + 1) - EDGE_MARGIN,
                // Extended vertically to include the room's floor and ceiling tiles.
                y: 0.5 * MAX_ROOM_Y + EDGE_MARGIN,
                z: 0.5 * (this.rowMax - this.rowMin + 1) - EDGE_MARGIN,
            },
        };
    }

    encode(bufferState: BufferState)
    {
        new EncodableRawByteNumber(this.rowMin).encode(bufferState);
        new EncodableRawByteNumber(this.rowMax).encode(bufferState);
        new EncodableRawByteNumber(this.colMin).encode(bufferState);
        new EncodableRawByteNumber(this.colMax).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const rowMin = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const rowMax = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const colMin = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const colMax = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        return new RestrictedZone(rowMin, rowMax, colMin, colMax);
    }
}

// Well inside a voxel, larger than coordinate rounding.
const EDGE_MARGIN = 0.01;
