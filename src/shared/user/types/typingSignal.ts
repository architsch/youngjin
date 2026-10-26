import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";

// A user starting or stopping typing a line in the chat: the helper the line would be for stands still facing them
// meanwhile (see HelperAgentUtil).
export default class TypingSignal extends EncodableData
{
    typing: boolean;

    constructor(typing: boolean)
    {
        super();
        this.typing = typing;
    }

    encode(bufferState: BufferState)
    {
        bufferState.view[bufferState.byteIndex++] = this.typing ? 1 : 0;
    }

    static decode(bufferState: BufferState): EncodableData
    {
        return new TypingSignal(bufferState.view[bufferState.byteIndex++] === 1);
    }
}
