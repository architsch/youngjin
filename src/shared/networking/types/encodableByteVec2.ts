import BufferState from "./bufferState";
import EncodableData from "./encodableData";
import EncodableByteNumber from "./encodableByteNumber";
import Vec2 from "../../math/types/vec2";

let temp_min = 0;
let temp_max = 0;

export default class EncodableByteVec2 extends EncodableData
{
    v: Vec2;
    min: number;
    max: number;

    constructor(v: Vec2, min: number, max: number)
    {
        super();
        this.v = v;
        this.min = min;
        this.max = max;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteNumber(this.v.x, this.min, this.max).encode(bufferState);
        new EncodableByteNumber(this.v.y, this.min, this.max).encode(bufferState);
    }

    static decodeWithParams(bufferState: BufferState, min: number, max: number): EncodableData
    {
        temp_min = min;
        temp_max = max;
        return EncodableByteVec2.decode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const xData = EncodableByteNumber.decodeWithParams(bufferState, temp_min, temp_max) as EncodableByteNumber;
        const yData = EncodableByteNumber.decodeWithParams(bufferState, temp_min, temp_max) as EncodableByteNumber;
        return new EncodableByteVec2(
            {x: xData.n, y: yData.n},
            temp_min,
            temp_max
        );
    }
}