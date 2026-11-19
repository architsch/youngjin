import BufferState from "./bufferState";
import EncodableData from "./encodableData";
import EncodableByteNumber from "./encodableByteNumber";
import Vec3 from "../../math/types/vec3";

let temp_minX = 0;
let temp_maxX = 0;
let temp_minY = 0;
let temp_maxY = 0;
let temp_minZ = 0;
let temp_maxZ = 0;

export default class EncodableByteVec3 extends EncodableData
{
    v: Vec3;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;

    constructor(v: Vec3, minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number)
    {
        super();
        this.v = v;
        this.minX = minX;
        this.maxX = maxX;
        this.minY = minY;
        this.maxY = maxY;
        this.minZ = minZ;
        this.maxZ = maxZ;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteNumber(this.v.x, this.minX, this.maxX).encode(bufferState);
        new EncodableByteNumber(this.v.y, this.minY, this.maxY).encode(bufferState);
        new EncodableByteNumber(this.v.z, this.minZ, this.maxZ).encode(bufferState);
    }

    static decodeWithParams(bufferState: BufferState,
        minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): EncodableData
    {
        temp_minX = minX;
        temp_maxX = maxX;
        temp_minY = minY;
        temp_maxY = maxY;
        temp_minZ = minZ;
        temp_maxZ = maxZ;
        return EncodableByteVec3.decode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const xData = EncodableByteNumber.decodeWithParams(bufferState, temp_minX, temp_maxX) as EncodableByteNumber;
        const yData = EncodableByteNumber.decodeWithParams(bufferState, temp_minY, temp_maxY) as EncodableByteNumber;
        const zData = EncodableByteNumber.decodeWithParams(bufferState, temp_minZ, temp_maxZ) as EncodableByteNumber;
        return new EncodableByteVec3(
            {x: xData.n, y: yData.n, z: zData.n},
            temp_minX, temp_maxX,
            temp_minY, temp_maxY,
            temp_minZ, temp_maxZ
        );
    }
}