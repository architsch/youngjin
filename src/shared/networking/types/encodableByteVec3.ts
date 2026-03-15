import BufferState from "./bufferState";
import EncodableData from "./encodableData";
import EncodableByteNumber from "./encodableByteNumber";
import Vec3 from "../../math/types/vec3";

let temp_minXZ = 0;
let temp_maxXZ = 0;
let temp_minY = 0;
let temp_maxY = 0;

export default class EncodableByteVec3 extends EncodableData
{
    v: Vec3;
    minXZ: number;
    maxXZ: number;
    minY: number;
    maxY: number;

    constructor(v: Vec3, minXZ: number, maxXZ: number, minY: number, maxY: number)
    {
        super();
        this.v = v;
        this.minXZ = minXZ;
        this.maxXZ = maxXZ;
        this.minY = minY;
        this.maxY = maxY;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteNumber(this.v.x, this.minXZ, this.maxXZ).encode(bufferState);
        new EncodableByteNumber(this.v.y, this.minY, this.maxY).encode(bufferState);
        new EncodableByteNumber(this.v.z, this.minXZ, this.maxXZ).encode(bufferState);
    }

    static decodeWithParams(bufferState: BufferState, minXZ: number, maxXZ: number, minY: number, maxY: number): EncodableData
    {
        temp_minXZ = minXZ;
        temp_maxXZ = maxXZ;
        temp_minY = minY;
        temp_maxY = maxY;
        return EncodableByteVec3.decode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const xData = EncodableByteNumber.decodeWithParams(bufferState, temp_minXZ, temp_maxXZ) as EncodableByteNumber;
        const yData = EncodableByteNumber.decodeWithParams(bufferState, temp_minY, temp_maxY) as EncodableByteNumber;
        const zData = EncodableByteNumber.decodeWithParams(bufferState, temp_minXZ, temp_maxXZ) as EncodableByteNumber;
        return new EncodableByteVec3(
            {x: xData.n, y: yData.n, z: zData.n},
            temp_minXZ, temp_maxXZ,
            temp_minY, temp_maxY
        );
    }
}