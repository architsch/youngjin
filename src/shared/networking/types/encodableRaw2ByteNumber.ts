import BufferState from "./bufferState";
import EncodableData from "./encodableData";

export default class EncodableRaw2ByteNumber extends EncodableData
{
    // The range this field can carry. A caller that has to fit a growing quantity into a signal
    // checks against this rather than against a literal of its own, so that widening the field is
    // enough to widen everything measured against it.
    static readonly MIN_VALUE = 0;
    static readonly MAX_VALUE = 65535;

    n: number;

    constructor(n: number)
    {
        super();
        this.n = n;
    }

    encode(bufferState: BufferState)
    {
        if (this.n < EncodableRaw2ByteNumber.MIN_VALUE || this.n > EncodableRaw2ByteNumber.MAX_VALUE)
            console.error(`Number is out of its desired range (n = ${this.n})`);
        if (Math.floor(this.n) != this.n)
            console.error(`Number is not an integer (n = ${this.n})`);
        const n = Math.min(EncodableRaw2ByteNumber.MAX_VALUE,
            Math.max(EncodableRaw2ByteNumber.MIN_VALUE, Math.floor(this.n)));
        const firstHalf = ((n >> 8) & 0b11111111);
        const secondHalf = (n & 0b11111111);
        bufferState.view[bufferState.byteIndex++] = firstHalf;
        bufferState.view[bufferState.byteIndex++] = secondHalf;
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const firstHalf = bufferState.view[bufferState.byteIndex++];
        const secondHalf = bufferState.view[bufferState.byteIndex++];
        return new EncodableRaw2ByteNumber(
            (firstHalf << 8) | secondHalf
        );
    }
}
