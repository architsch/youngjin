import { MAX_ENCODED_VOXEL_GRID_BYTES } from "../../system/sharedConstants";
import BufferState from "../types/bufferState";

// Room contents and signal batches are encoded into one reusable buffer rather than into a fresh
// allocation each time, since both are written continuously while a room is live.
//
// It has to be sized for the largest thing that is ever encoded in one go, which is a whole room:
// its voxel grid built solid, plus everything standing in it. Writing past the end of a typed array
// is silently ignored rather than throwing, so a buffer that is merely "big enough for the rooms we
// have seen" would turn an unusually full room into a quietly truncated one — saved short, and read
// back as a room that loses everything past the cut.
//
// The allowance for a room's objects is deliberately generous: what an object costs depends on the
// metadata it carries (a composed character's parts, a painting's image path), and a room's objects
// are worth far less than the certainty that a room is never silently clipped.
const MAX_ENCODED_OBJECTS_BYTES = 128 * 1024;
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

        // The buffer holds no more than it was sized for, and a write past its end went nowhere at
        // all — so an encoding that ran over produced a result missing everything after the point
        // it overflowed at. Refuse it rather than hand back a plausible-looking truncation, which
        // would be saved over the real room or sent to a client as the whole of one.
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
