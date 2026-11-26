import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import { PetInjection } from "./petInjection";

// A battery or a wrench put into a pet (see PetInjectionUtil). Anyone in the pet's room asks with it, and the server,
// having taken what it costs from them (see PetServerUtil), tells the whole room with it, whoever asked included:
// whoever plays the pet then makes it the better for it, and everyone sees and hears it.
export default class InjectPetSignal extends EncodableData
{
    roomID: string;
    objectId: string;
    injection: PetInjection;

    constructor(roomID: string, objectId: string, injection: PetInjection)
    {
        super();
        this.roomID = roomID;
        this.objectId = objectId;
        this.injection = injection;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableByteString(this.objectId).encode(bufferState);
        new EncodableRawByteNumber(this.injection).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const injection = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        return new InjectPetSignal(roomID, objectId, injection);
    }
}
