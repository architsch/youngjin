import Num from "../../math/util/num";
import BufferState from "./bufferState";
import EncodableData from "./encodableData";

let temp_min = 0;
let temp_max = 0;

export default class EncodableByteNumber extends EncodableData
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
        bufferState.view[bufferState.byteIndex++] = Math.floor(Num.normalizeInRange(this.n, this.min, this.max) * 255.9999);
    }

    static decodeWithParams(bufferState: BufferState, min: number, max: number): EncodableData
    {
        temp_min = min;
        temp_max = max;
        return EncodableByteNumber.decode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        return new EncodableByteNumber(
            temp_min + bufferState.view[bufferState.byteIndex++] * (temp_max - temp_min) / 255.9999,
            temp_min,
            temp_max
        );
    }
}