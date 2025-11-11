import BufferState from "./types/bufferState";

const writeBuffer = new ArrayBuffer(65536);
let writeBufferReserved = false;

const Encoding =
{
    startWrite: (): BufferState =>
    {
        if (writeBufferReserved)
            throw new Error("WriteBuffer is already reserved.");
        writeBufferReserved = true;
        return { view: new Uint8Array(writeBuffer), index: 0 };
    },
    endWrite: (bufferState: BufferState): ArrayBuffer =>
    {
        if (!writeBufferReserved)
            console.error("WriteBuffer is already free.");
        writeBufferReserved = false;
        const subBuffer = bufferState.view.buffer.slice(0, bufferState.index) as ArrayBuffer;
        return subBuffer;
    },
}

export default Encoding;