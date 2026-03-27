import ObjectTransform from "./objectTransform";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";

export default class SetObjectTransformSignal extends EncodableData
{
    roomID: string;
    objectId: string;
    transform: ObjectTransform;
    ignorePhysics: boolean;

    constructor(roomID: string, objectId: string, transform: ObjectTransform, ignorePhysics: boolean)
    {
        super();
        this.roomID = roomID;
        this.objectId = objectId;
        this.transform = transform;
        this.ignorePhysics = ignorePhysics;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableByteString(this.objectId).encode(bufferState);
        this.transform.encode(bufferState);
        bufferState.view[bufferState.byteIndex++] = this.ignorePhysics ? 1 : 0;
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const transform = ObjectTransform.decode(bufferState) as ObjectTransform;
        const ignorePhysics = bufferState.view[bufferState.byteIndex++] != 0;
        return new SetObjectTransformSignal(roomID, objectId, transform, ignorePhysics);
    }
}