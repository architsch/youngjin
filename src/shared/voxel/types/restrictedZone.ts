import AABB3 from "../../math/types/aabb3";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import { MAX_ROOM_Y } from "../../system/sharedConstants";

// A rectangular stretch of the room that only a superuser may edit — see
// @docs/gameplay/restricted_zone.md for who that is and what the restriction covers.
//
// A zone is given as rows and columns alone because it always reaches the whole height of the room.
// What zones exist to protect is the room's shape as seen from the next room along: a hole in a
// boundary wall says "outdoors" wherever it is cut, so a zone that stopped short of the ceiling
// would leave the part of the wall above it open to exactly the hole it was drawn to prevent.
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

    // The volume an edit is tested against. Both of the margins below are load-bearing, because the
    // overlap tests this volume is fed to (see Geometry3DUtil) compare strictly: something lying
    // exactly on a face of the box is outside it.
    getVolume(): AABB3
    {
        return {
            center: {
                x: 0.5 * (this.colMax + this.colMin + 1),
                y: 0.5 * MAX_ROOM_Y,
                z: 0.5 * (this.rowMax + this.rowMin + 1),
            },
            halfSize: {
                // Drawn in far enough to leave the zone's own outermost faces lying outside it, so
                // the wall a zone protects can still be painted from the side it is seen from. What
                // the zone holds shut is the wall itself; how it is finished is nobody's structural
                // business.
                x: 0.5 * (this.colMax - this.colMin + 1) - EDGE_MARGIN,
                // Pushed out far enough to take in the room's own floor and ceiling tiles, which sit
                // exactly on y=0 and y=MAX_ROOM_Y and would otherwise fall outside the volume that
                // is meant to reach the whole height of the room.
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

// Small enough to be well inside a voxel, large enough to survive the rounding of the coordinates
// that are compared against it.
const EDGE_MARGIN = 0.01;
