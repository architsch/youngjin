import BufferState from "./bufferState";
import EncodableData from "./encodableData";

export default interface SignalTypeConfig
{
    signalType: string;
    throttleInterval: number; // in milliseconds
    decode: (bufferState: BufferState) => EncodableData,
}