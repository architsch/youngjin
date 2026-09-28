import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import ObjectTransform from "./objectTransform";

export default class SetObjectMetadataSignal extends EncodableData
{
    roomID: string;
    objectId: string;
    metadataKey: number;
    metadataValue: string;
    // Set along with the value, as one edit, when the value changes the scale the object is pinned to (see
    // ObjectScalingConfig.getFixedScale): the two apart would leave it in a state no edit may produce.
    transform?: ObjectTransform;

    constructor(roomID: string, objectId: string, metadataKey: number, metadataValue: string,
        transform?: ObjectTransform)
    {
        super();
        this.roomID = roomID;
        this.objectId = objectId;
        this.metadataKey = metadataKey;
        this.metadataValue = metadataValue;
        this.transform = transform;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableByteString(this.objectId).encode(bufferState);
        new EncodableRawByteNumber(this.metadataKey).encode(bufferState);
        new EncodableByteString(this.metadataValue).encode(bufferState);
        bufferState.view[bufferState.byteIndex++] = this.transform ? 1 : 0;
        if (this.transform)
            this.transform.encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const metadataKey = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const metadataValue = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const hasTransform = bufferState.view[bufferState.byteIndex++] != 0;
        const transform = hasTransform ? ObjectTransform.decode(bufferState) as ObjectTransform : undefined;
        return new SetObjectMetadataSignal(roomID, objectId, metadataKey, metadataValue, transform);
    }
}
