import BufferState from "./bufferState";
import EncodableData from "./encodableData";

export default class EncodableRawByteNumber extends EncodableData
{
    n: number;

    constructor(n: number)
    {
        super();
        this.n = n;
    }

    encode(bufferState: BufferState)
    {
        if (this.n < 0 || this.n > 255)
            console.error(`Number is out of its desired range (n = ${this.n})`);
        if (Math.floor(this.n) != this.n)
            console.error(`Number is not an integer (n = ${this.n})`);
        const n = Math.min(255, Math.max(0, Math.floor(this.n)));
        bufferState.view[bufferState.index++] = n;
    }

    static decode(bufferState: BufferState): EncodableData
    {
        return new EncodableRawByteNumber(
            bufferState.view[bufferState.index++]
        );
    }
}