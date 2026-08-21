import BufferState from "./bufferState";
import EncodableData from "./encodableData";

export default class EncodableRawByteNumber extends EncodableData
{
    // The range this field can carry. A caller that has to fit a growing quantity into a signal
    // checks against this rather than against a literal of its own, so that widening the field is
    // enough to widen everything measured against it.
    static readonly MIN_VALUE = 0;
    static readonly MAX_VALUE = 255;

    n: number;

    constructor(n: number)
    {
        super();
        this.n = n;
    }

    encode(bufferState: BufferState)
    {
        if (this.n < EncodableRawByteNumber.MIN_VALUE || this.n > EncodableRawByteNumber.MAX_VALUE)
            console.error(`Number is out of its desired range (n = ${this.n})`);
        if (Math.floor(this.n) != this.n)
            console.error(`Number is not an integer (n = ${this.n})`);
        const n = Math.min(EncodableRawByteNumber.MAX_VALUE,
            Math.max(EncodableRawByteNumber.MIN_VALUE, Math.floor(this.n)));
        bufferState.view[bufferState.byteIndex++] = n;
    }

    static decode(bufferState: BufferState): EncodableData
    {
        return new EncodableRawByteNumber(
            bufferState.view[bufferState.byteIndex++]
        );
    }
}
