import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableRaw4ByteNumber from "../../networking/types/encodableRaw4ByteNumber";

// That coming back has earned the user this many dollars, which what they were last told they hold includes.
export default class LoginRewardSignal extends EncodableData
{
    dollars: number;

    constructor(dollars: number)
    {
        super();
        this.dollars = dollars;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRaw4ByteNumber(this.dollars).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        return new LoginRewardSignal((EncodableRaw4ByteNumber.decode(bufferState) as EncodableRaw4ByteNumber).n);
    }
}
