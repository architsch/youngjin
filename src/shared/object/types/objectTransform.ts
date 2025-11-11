import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteNumber from "../../networking/types/encodableByteNumber";

const xzRange = [0, 32];
const yRange = [-1, 4 + 0.0196058823529414]; // Note: The addition of this weird constant is to make sure that 0 will be quantized to a value which is as close to 0 as possible.
const dirVecRange = [-1, 1 + 0.0157472440944882]; // Note: The addition of this weird constant is to make sure that 0 will be quantized to a value which is as close to 0 as possible.

export default class ObjectTransform extends EncodableData
{
    x: number;
    y: number;
    z: number;
    dirX: number;
    dirY: number;
    dirZ: number;

    constructor(x: number, y: number, z: number, dirX: number, dirY: number, dirZ: number)
    {
        super();
        this.x = x;
        this.y = y;
        this.z = z;
        this.dirX = dirX;
        this.dirY = dirY;
        this.dirZ = dirZ;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteNumber(this.x, xzRange[0], xzRange[1]).encode(bufferState);
        new EncodableByteNumber(this.y, yRange[0], yRange[1]).encode(bufferState);
        new EncodableByteNumber(this.z, xzRange[0], xzRange[1]).encode(bufferState);
        new EncodableByteNumber(this.dirX, dirVecRange[0], dirVecRange[1]).encode(bufferState);
        new EncodableByteNumber(this.dirY, dirVecRange[0], dirVecRange[1]).encode(bufferState);
        new EncodableByteNumber(this.dirZ, dirVecRange[0], dirVecRange[1]).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const x = (EncodableByteNumber.decodeWithParams(bufferState, xzRange[0], xzRange[1]) as EncodableByteNumber).n;
        const y = (EncodableByteNumber.decodeWithParams(bufferState, yRange[0], yRange[1]) as EncodableByteNumber).n;
        const z = (EncodableByteNumber.decodeWithParams(bufferState, xzRange[0], xzRange[1]) as EncodableByteNumber).n;
        const dirX = (EncodableByteNumber.decodeWithParams(bufferState, dirVecRange[0], dirVecRange[1]) as EncodableByteNumber).n;
        const dirY = (EncodableByteNumber.decodeWithParams(bufferState, dirVecRange[0], dirVecRange[1]) as EncodableByteNumber).n;
        const dirZ = (EncodableByteNumber.decodeWithParams(bufferState, dirVecRange[0], dirVecRange[1]) as EncodableByteNumber).n;
        return new ObjectTransform(x, y, z, dirX, dirY, dirZ);
    }
}