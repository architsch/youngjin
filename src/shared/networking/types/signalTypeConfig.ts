import BufferState from "./bufferState";
import EncodableData from "./encodableData";

export default interface SignalTypeConfig
{
    signalType: string;

    // Minimum ms between client sends of this signal type.
    minClientToServerSendInterval: number;

    // Method for decoding the binary-encoded signal back to its original form.
    decode: (bufferState: BufferState) => EncodableData,
}