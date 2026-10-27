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
    // A move only shown, which leaves the object where its room keeps it: a helper's walk (see HelperBehaviorUtil),
    // which only whoever plays it makes.
    shown: boolean;

    constructor(roomID: string, objectId: string, transform: ObjectTransform, ignorePhysics: boolean,
        shown: boolean = false)
    {
        super();
        this.roomID = roomID;
        this.objectId = objectId;
        this.transform = transform;
        this.ignorePhysics = ignorePhysics;
        this.shown = shown;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableByteString(this.objectId).encode(bufferState);
        this.transform.encode(bufferState);
        bufferState.view[bufferState.byteIndex++] = (this.ignorePhysics ? 1 : 0) | (this.shown ? 2 : 0);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const transform = ObjectTransform.decode(bufferState) as ObjectTransform;
        const flags = bufferState.view[bufferState.byteIndex++];
        return new SetObjectTransformSignal(roomID, objectId, transform, (flags & 1) != 0, (flags & 2) != 0);
    }
}