import BufferState from "./bufferState";
import EncodableData from "./encodableData";

export default class EncodableRaw4ByteNumber extends EncodableData
{
    // The range this field can carry. A caller that has to fit a growing quantity into a signal
    // checks against this rather than against a literal of its own, so that widening the field is
    // enough to widen everything measured against it.
    static readonly MIN_VALUE = 0;
    static readonly MAX_VALUE = 4294967295;

    n: number;

    constructor(n: number)
    {
        super();
        this.n = n;
    }

    encode(bufferState: BufferState)
    {
        if (this.n < EncodableRaw4ByteNumber.MIN_VALUE || this.n > EncodableRaw4ByteNumber.MAX_VALUE)
            console.error(`Number is out of its desired range (n = ${this.n})`);
        if (Math.floor(this.n) != this.n)
            console.error(`Number is not an integer (n = ${this.n})`);
        const n = Math.min(EncodableRaw4ByteNumber.MAX_VALUE,
            Math.max(EncodableRaw4ByteNumber.MIN_VALUE, Math.floor(this.n)));
        const firstQuarter = ((n >>> 24) & 0b11111111);
        const secondQuarter = ((n >>> 16) & 0b11111111);
        const thirdQuarter = ((n >>> 8) & 0b11111111);
        const fourthQuarter = (n & 0b11111111);
        bufferState.view[bufferState.byteIndex++] = firstQuarter;
        bufferState.view[bufferState.byteIndex++] = secondQuarter;
        bufferState.view[bufferState.byteIndex++] = thirdQuarter;
        bufferState.view[bufferState.byteIndex++] = fourthQuarter;
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const firstQuarter = bufferState.view[bufferState.byteIndex++];
        const secondQuarter = bufferState.view[bufferState.byteIndex++];
        const thirdQuarter = bufferState.view[bufferState.byteIndex++];
        const fourthQuarter = bufferState.view[bufferState.byteIndex++];
        // Reassembled unsigned: the top bit falling inside a 32-bit signed shift would otherwise
        // read every value above 2^31 back as a negative one.
        return new EncodableRaw4ByteNumber(
            (((firstQuarter << 24) | (secondQuarter << 16) | (thirdQuarter << 8) | fourthQuarter) >>> 0)
        );
    }
}
