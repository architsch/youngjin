import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";
import EncodableByteString from "../../../networking/types/encodableByteString";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";
import { PERSISTENT_OBJ_TASK_TYPE_MOVE } from "../../../system/sharedConstants";
import UpdatePersistentObjectGroupTaskParams from "./updatePersistentObjectGroupTaskParams";

// Offsets are encoded as signed values: raw byte value 128 = 0 offset.
// Range: -128 to +127 mapped to raw 0-255, but we only need small offsets.
// We encode dx,dy,dz as: rawByte = floor(2 * offset) + 128
// This gives us a range of -64 to +63.5 in 0.5 increments.

export default class MovePersistentObjectParams extends UpdatePersistentObjectGroupTaskParams
{
    objectId: string;
    dx: number;
    dy: number;
    dz: number;

    constructor(objectId: string, dx: number, dy: number, dz: number)
    {
        super(PERSISTENT_OBJ_TASK_TYPE_MOVE);
        this.objectId = objectId;
        this.dx = dx;
        this.dy = dy;
        this.dz = dz;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.objectId).encode(bufferState);
        new EncodableRawByteNumber(Math.floor(2 * this.dx) + 128).encode(bufferState);
        new EncodableRawByteNumber(Math.floor(2 * this.dy) + 128).encode(bufferState);
        new EncodableRawByteNumber(Math.floor(2 * this.dz) + 128).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const dxRaw = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const dyRaw = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const dzRaw = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const dx = 0.5 * (dxRaw - 128);
        const dy = 0.5 * (dyRaw - 128);
        const dz = 0.5 * (dzRaw - 128);
        return new MovePersistentObjectParams(objectId, dx, dy, dz);
    }
}
