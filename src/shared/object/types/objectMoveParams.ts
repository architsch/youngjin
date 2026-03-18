import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableRawSignedByteNumber from "../../networking/types/encodableRawSignedByteNumber";

export default class ObjectMoveParams extends EncodableData
{
    roomID: string;
    objectId: string;
    // dx, dy, dz are encoded as integers (multiplied by 2) to fit signed byte range.
    // e.g. 0.5 -> 1, -0.5 -> -1
    dx: number;
    dy: number;
    dz: number;

    constructor(roomID: string, objectId: string, dx: number, dy: number, dz: number)
    {
        super();
        this.roomID = roomID;
        this.objectId = objectId;
        this.dx = dx;
        this.dy = dy;
        this.dz = dz;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableByteString(this.objectId).encode(bufferState);
        new EncodableRawSignedByteNumber(Math.round(this.dx * 2)).encode(bufferState);
        new EncodableRawSignedByteNumber(Math.round(this.dy * 2)).encode(bufferState);
        new EncodableRawSignedByteNumber(Math.round(this.dz * 2)).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const dx = (EncodableRawSignedByteNumber.decode(bufferState) as EncodableRawSignedByteNumber).n * 0.5;
        const dy = (EncodableRawSignedByteNumber.decode(bufferState) as EncodableRawSignedByteNumber).n * 0.5;
        const dz = (EncodableRawSignedByteNumber.decode(bufferState) as EncodableRawSignedByteNumber).n * 0.5;
        return new ObjectMoveParams(roomID, objectId, dx, dy, dz);
    }
}
