import Num from "../../math/util/num";
import BufferState from "./bufferState";
import EncodableData from "./encodableData";

let temp_min = 0;
let temp_max = 0;

export default class Encodable2ByteNumber extends EncodableData
{
    n: number;
    min: number;
    max: number;

    constructor(n: number, min: number, max: number)
    {
        super();
        this.n = n;
        this.min = min;
        this.max = max;
    }

    encode(bufferState: BufferState)
    {
        const n = Math.floor(Num.normalizeInRangeWithWarning(this.n, this.min, this.max) * 65535.9999);
        const firstHalf = ((n >> 8) & 0b11111111);
        const secondHalf = (n & 0b11111111);
        bufferState.view[bufferState.byteIndex++] = firstHalf;
        bufferState.view[bufferState.byteIndex++] = secondHalf;
    }

    static decodeWithParams(bufferState: BufferState, min: number, max: number): EncodableData
    {
        temp_min = min;
        temp_max = max;
        return Encodable2ByteNumber.decode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const firstHalf = bufferState.view[bufferState.byteIndex++];
        const secondHalf = bufferState.view[bufferState.byteIndex++];
        return new Encodable2ByteNumber(
            temp_min + ((firstHalf << 8) | secondHalf) * (temp_max - temp_min) / 65535.9999,
            temp_min,
            temp_max
        );
    }
}