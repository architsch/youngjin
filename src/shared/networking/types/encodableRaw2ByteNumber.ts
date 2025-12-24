import BufferState from "./bufferState";
import EncodableData from "./encodableData";

export default class EncodableRaw2ByteNumber extends EncodableData
{
    n: number;

    constructor(n: number)
    {
        super();
        this.n = n;
    }

    encode(bufferState: BufferState)
    {
        if (this.n < 0 || this.n > 65535)
            console.error(`Number is out of its desired range (n = ${this.n})`);
        if (Math.floor(this.n) != this.n)
            console.error(`Number is not an integer (n = ${this.n})`);
        const n = Math.min(65535, Math.max(0, Math.floor(this.n)));
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