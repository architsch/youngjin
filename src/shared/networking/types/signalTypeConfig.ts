import BufferState from "./bufferState";
import EncodableData from "./encodableData";

export default interface SignalTypeConfig
{
    signalType: string;

    // Minimum time that the client must wait after sending a signal of the given type,
    // before sending another signal of the same type (in milliseconds).
    minClientToServerSendInterval: number;

    // Maximum time that the client is allowed to spend before it applies the result of the
    // received signal on the client side (in milliseconds).
    maxClientSideReceptionPeriod: number;

    // Method for decoding the binary-encoded signal back to its original form.
    decode: (bufferState: BufferState) => EncodableData,
}