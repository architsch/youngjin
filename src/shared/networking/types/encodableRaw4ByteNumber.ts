import BufferState from "./bufferState";
import EncodableData from "./encodableData";

export default class EncodableRaw4ByteNumber extends EncodableData
{
    n: number;

    constructor(n: number)
    {
        super();
        this.n = n;
    }

    encode(bufferState: BufferState)
    {
        if (this.n < 0 || this.n > 4294967295)
            console.error(`Number is out of its desired range (n = ${this.n})`);
        if (Math.floor(this.n) != this.n)
            console.error(`Number is not an integer (n = ${this.n})`);
        const n = Math.min(4294967295, Math.max(0, Math.floor(this.n)));
        const firstQuarter = ((n >> 24) & 0b11111111);
        const secondQuarter = ((n >> 16) & 0b11111111);
        const thirdQuarter = ((n >> 8) & 0b11111111);
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
        return new EncodableRaw4ByteNumber(
            (firstQuarter << 24) | (secondQuarter << 16) | (thirdQuarter << 8) | fourthQuarter
        );
    }
}