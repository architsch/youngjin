import Vec2 from "../../math/types/vec2";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableByteVec2 from "../../networking/types/encodableByteVec2";

export default class ObjectDesyncResolveParams extends EncodableData
{
    objectId: string;
    resolvedPos: Vec2;

    constructor(objectId: string, resolvedPos: Vec2)
    {
        super();
        this.objectId = objectId;
        this.resolvedPos = resolvedPos;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.objectId).encode(bufferState);
        new EncodableByteVec2(this.resolvedPos, 0, 32).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const resolvedPos = (EncodableByteVec2.decodeWithParams(bufferState, 0, 32) as EncodableByteVec2).v;
        return new ObjectDesyncResolveParams(objectId, resolvedPos);
    }
}