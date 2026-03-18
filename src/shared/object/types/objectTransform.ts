import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteVec3 from "../../networking/types/encodableByteVec3";
import Vec3 from "../../math/types/vec3";

const xzRange = [0, 32];
const yRange = [-1, 4 + 0.0196058823529414]; // Note: The addition of this weird constant is to make sure that 0 will be quantized to a value which is as close to 0 as possible.
const dirVecRange = [-1, 1 + 0.0157472440944882]; // Note: The addition of this weird constant is to make sure that 0 will be quantized to a value which is as close to 0 as possible.

export default class ObjectTransform extends EncodableData
{
    pos: Vec3;
    dir: Vec3;

    constructor(pos: Vec3, dir: Vec3)
    {
        super();
        this.pos = pos;
        this.dir = dir;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteVec3(this.pos, xzRange[0], xzRange[1], yRange[0], yRange[1]).encode(bufferState);
        new EncodableByteVec3(this.dir, dirVecRange[0], dirVecRange[1], dirVecRange[0], dirVecRange[1]).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const posData = EncodableByteVec3.decodeWithParams(bufferState, xzRange[0], xzRange[1], yRange[0], yRange[1]) as EncodableByteVec3;
        const dirData = EncodableByteVec3.decodeWithParams(bufferState, dirVecRange[0], dirVecRange[1], dirVecRange[0], dirVecRange[1]) as EncodableByteVec3;
        return new ObjectTransform(posData.v, dirData.v);
    }
}