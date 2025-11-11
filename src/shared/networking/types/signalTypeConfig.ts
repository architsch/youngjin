import BufferState from "./bufferState";
import EncodableData from "./encodableData";

export default interface SignalTypeConfig
{
    signalType: string;
    decode: (bufferState: BufferState) => EncodableData,
}