import { MAX_ENCODED_VOXEL_GRID_BYTES } from "../../system/sharedConstants";
import BufferState from "../types/bufferState";

// One reusable encoding buffer for room contents and signal batches, sized for the largest encoding: a
// solid voxel grid plus an object allowance that covers every category at its cap with every string at
// its longest (tests assert it). Typed arrays silently drop out-of-range writes, so an undersized buffer
// would silently truncate a full room.
export const MAX_ENCODED_OBJECTS_BYTES = 256 * 1024;
const writeBuffer = new ArrayBuffer(MAX_ENCODED_VOXEL_GRID_BYTES + MAX_ENCODED_OBJECTS_BYTES);

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

        // Refuse an overflowed (truncated) encoding rather than saving or sending it as a whole room.
        if (bufferState.byteIndex > bufferState.view.length)
        {
            const overflowBytes = bufferState.byteIndex - bufferState.view.length;
            startByteIndex = 0;
            throw new Error(`Encoding overflowed the write buffer by ${overflowBytes} bytes ` +
                `(buffer size = ${writeBuffer.byteLength}), so the encoded data is incomplete.`);
        }

        const subBuffer = bufferState.view.buffer.slice(startByteIndex, bufferState.byteIndex) as ArrayBuffer;
        startByteIndex = 0;
        return subBuffer;
    },
}

export default EncodingUtil;
