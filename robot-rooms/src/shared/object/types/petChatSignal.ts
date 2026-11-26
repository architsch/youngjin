import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";

// The server's word to the browser that plays a pet, of someone speaking to it (see PetChatUtil): first that they have,
// without words, for the pet to turn to them; then what it answers, as Claude wrote it, and the mood it says it in (see
// PetLine). Nobody else is sent it: what the pet then does and says reaches the room as all it does.
export default class PetChatSignal extends EncodableData
{
    roomID: string;
    objectId: string;
    // Whoever spoke to it, by their player's object.
    speakerObjectId: string;
    // "" for none yet.
    text: string;
    mood: number;

    constructor(roomID: string, objectId: string, speakerObjectId: string, text: string, mood: number)
    {
        super();
        this.roomID = roomID;
        this.objectId = objectId;
        this.speakerObjectId = speakerObjectId;
        this.text = text;
        this.mood = mood;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableByteString(this.objectId).encode(bufferState);
        new EncodableByteString(this.speakerObjectId).encode(bufferState);
        new EncodableByteString(this.text).encode(bufferState);
        new EncodableRawByteNumber(Math.sign(this.mood) + 1).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const speakerObjectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const text = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const mood = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n - 1;
        return new PetChatSignal(roomID, objectId, speakerObjectId, text, Math.max(-1, Math.min(1, mood)));
    }
}
