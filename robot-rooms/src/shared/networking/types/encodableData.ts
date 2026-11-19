import BufferState from "./bufferState";

export default abstract class EncodableData
{
    abstract encode(bufferState: BufferState): void;
    static decode(bufferState: BufferState): EncodableData { throw new Error("'decode' method is not implemented."); }
}