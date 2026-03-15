import Vec3 from "../../math/types/vec3";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableByteVec3 from "../../networking/types/encodableByteVec3";
import { MAX_ROOM_Y } from "../../system/sharedConstants";

export default class ObjectDesyncResolveParams extends EncodableData
{
    objectId: string;
    resolvedPos: Vec3;

    constructor(objectId: string, resolvedPos: Vec3)
    {
        super();
        this.objectId = objectId;
        this.resolvedPos = resolvedPos;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.objectId).encode(bufferState);
        new EncodableByteVec3(this.resolvedPos, 0, 32, -1, MAX_ROOM_Y + 1).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const resolvedPos = (EncodableByteVec3.decodeWithParams(bufferState, 0, 32, -1, MAX_ROOM_Y + 1) as EncodableByteVec3).v;
        return new ObjectDesyncResolveParams(objectId, resolvedPos);
    }
}