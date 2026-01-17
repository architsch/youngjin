import BufferState from "../types/bufferState";

const writeBuffer = new ArrayBuffer(65536);
let writeBufferReserved = false;
let startByteIndex = 0;

const EncodingUtil =
{
    startEncoding(byteIndex: number = 0): BufferState
    {
        if (writeBufferReserved)
            throw new Error("WriteBuffer is already reserved.");
        writeBufferReserved = true;
        startByteIndex = byteIndex;
        return new BufferState(new Uint8Array(writeBuffer, byteIndex));
    },
    endEncoding(bufferState: BufferState): ArrayBuffer
    {
        if (!writeBufferReserved)
            console.error("WriteBuffer is already free.");
        writeBufferReserved = false;
        const subBuffer = bufferState.view.buffer.slice(startByteIndex, bufferState.byteIndex) as ArrayBuffer;
        startByteIndex = 0;
        return subBuffer;
    },
}

export default EncodingUtil;