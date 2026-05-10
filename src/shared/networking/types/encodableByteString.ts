import BufferState from "./bufferState";
import EncodableData from "./encodableData";

// UTF-8 is used so multi-byte characters (e.g. Korean, emojis) survive the wire round-trip.
// The 0x00 terminator stays valid because UTF-8 never emits 0x00 except for U+0000,
// which we reject explicitly in encode().
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");

export default class EncodableByteString extends EncodableData
{
    str: string;

    constructor(str: string)
    {
        super();
        this.str = str;
    }

    encode(bufferState: BufferState)
    {
        const utf8Bytes = encoder.encode(this.str);
        for (let i = 0; i < utf8Bytes.length; ++i)
        {
            const byte = utf8Bytes[i];
            if (byte === 0)
            {
                console.error(`Null character (U+0000) is not allowed in EncodableByteString (string = ${this.str})`);
                continue;
            }
            bufferState.view[bufferState.byteIndex++] = byte;
        }
        bufferState.view[bufferState.byteIndex++] = 0; // null terminator
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const startIndex = bufferState.byteIndex;
        while (bufferState.byteIndex < bufferState.view.length &&
            bufferState.view[bufferState.byteIndex] !== 0)
        {
            bufferState.byteIndex++;
        }
        const str = decoder.decode(bufferState.view.subarray(startIndex, bufferState.byteIndex));
        bufferState.byteIndex++; // skip null terminator
        return new EncodableByteString(str);
    }
}