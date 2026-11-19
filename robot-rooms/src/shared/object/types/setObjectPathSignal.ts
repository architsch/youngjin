import BufferState from "../../networking/types/bufferState";
import Encodable2ByteVec3 from "../../networking/types/encodable2ByteVec3";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableData from "../../networking/types/encodableData";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import ObjectTransform from "./objectTransform";
import ObjectWaypoint from "./objectWaypoint";

// A byte's worth of speed, in world units a second.
const SPEED_STEP = 1 / 16;
const BOUNDS = ObjectTransform.encodableBounds;

// Where an object goes from wherever it is, which every client plays out by itself, so that one signal stands for a
// whole flight (see DollarBillUtil). It replaces any path the object is on. Only the server sends one.
export default class SetObjectPathSignal extends EncodableData
{
    roomID: string;
    objectId: string;
    waypoints: ObjectWaypoint[];

    constructor(roomID: string, objectId: string, waypoints: ObjectWaypoint[])
    {
        super();
        this.roomID = roomID;
        this.objectId = objectId;
        this.waypoints = waypoints;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableByteString(this.objectId).encode(bufferState);
        new EncodableRawByteNumber(this.waypoints.length).encode(bufferState);
        for (const {pos, speed} of this.waypoints)
        {
            new Encodable2ByteVec3(pos, 0, BOUNDS.maxX, 0, BOUNDS.maxY, 0, BOUNDS.maxZ).encode(bufferState);
            new EncodableRawByteNumber(Math.min(EncodableRawByteNumber.MAX_VALUE,
                Math.max(1, Math.round(speed / SPEED_STEP)))).encode(bufferState);
        }
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const numWaypoints = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const waypoints: ObjectWaypoint[] = [];
        for (let i = 0; i < numWaypoints; ++i)
        {
            const pos = (Encodable2ByteVec3.decodeWithParams(bufferState, 0, BOUNDS.maxX, 0, BOUNDS.maxY, 0,
                BOUNDS.maxZ) as Encodable2ByteVec3).v;
            const speed = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n * SPEED_STEP;
            waypoints.push({pos, speed});
        }
        return new SetObjectPathSignal(roomID, objectId, waypoints);
    }
}
