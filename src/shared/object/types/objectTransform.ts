import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import Vec3 from "../../math/types/vec3";
import Encodable2ByteVec3 from "../../networking/types/encodable2ByteVec3";

// Positions are stored as fractions of these ranges, so the ranges are part of the format: changing one
// silently moves every stored object. Frozen literals, independent of room dimensions (tying them to
// the room height once doubled every painting's height). A room that outgrows them needs a new
// ObjectGroup version and converter.
const X_RANGE = [0, 32];
const Y_RANGE = [0, 8];
const Z_RANGE = [0, 32];

const dirVecRange = [-1, 1]; // direction vector is a unit vector, so none of its components will ever exceed 1.

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

    // What the room's dimensions have to stay within for the ranges above to keep describing it.
    static get encodableBounds(): {maxX: number, maxY: number, maxZ: number}
    {
        return {maxX: X_RANGE[1], maxY: Y_RANGE[1], maxZ: Z_RANGE[1]};
    }

    encode(bufferState: BufferState)
    {
        new Encodable2ByteVec3(this.pos,
            X_RANGE[0], X_RANGE[1],
            Y_RANGE[0], Y_RANGE[1],
            Z_RANGE[0], Z_RANGE[1],).encode(bufferState);

        new Encodable2ByteVec3(this.dir,
            dirVecRange[0], dirVecRange[1],
            dirVecRange[0], dirVecRange[1],
            dirVecRange[0], dirVecRange[1]).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const posData = Encodable2ByteVec3.decodeWithParams(bufferState,
            X_RANGE[0], X_RANGE[1],
            Y_RANGE[0], Y_RANGE[1],
            Z_RANGE[0], Z_RANGE[1]) as Encodable2ByteVec3;

        const dirData = Encodable2ByteVec3.decodeWithParams(bufferState,
            dirVecRange[0], dirVecRange[1],
            dirVecRange[0], dirVecRange[1],
            dirVecRange[0], dirVecRange[1]) as Encodable2ByteVec3;

        return new ObjectTransform(posData.v, dirData.v);
    }
}
