import BufferState from "./bufferState";
import EncodableData from "./encodableData";

export default class EncodableRawSignedByteNumber extends EncodableData
{
    n: number;

    constructor(n: number)
    {
        super();
        this.n = n;
    }

    encode(bufferState: BufferState)
    {
        if (this.n < -128 || this.n > 127)
            console.error(`Number is out of its desired range (n = ${this.n})`);
        if (Math.floor(this.n) != this.n)
            console.error(`Number is not an integer (n = ${this.n})`);
        const n = Math.min(127, Math.max(-128, Math.floor(this.n))) + 128;
        bufferState.view[bufferState.byteIndex++] = n;
    }

    static decode(bufferState: BufferState): EncodableData
    {
        return new EncodableRawSignedByteNumber(
            bufferState.view[bufferState.byteIndex++] - 128
        );
    }
}