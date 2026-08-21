import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import Vec3 from "../../math/types/vec3";
import Encodable2ByteVec3 from "../../networking/types/encodable2ByteVec3";

// A position is not stored as a coordinate. It is stored as a *fraction* of the range below, and
// multiplied back out by whatever that range says on the way in — so these numbers are part of the
// format itself. Change one and every position already written moves, without a byte of stored data
// changing and without anything failing.
//
// That is why they are plain literals rather than being written in terms of MAX_ROOM_Y or
// NUM_VOXEL_ROWS/COLS. Tying them to the room's dimensions is what put every painting in the game
// at twice its height when the room grew a second storey: nothing about the objects changed, but the
// yardstick they were measured against did. A room dimension is free to change; a yardstick is not.
//
// So: these are frozen. Growing the room does not change them — the tests assert the room still fits
// inside them, and a room that outgrows one needs a new ObjectGroup version and a converter, exactly
// as the height change should have had.
const X_RANGE = [0, 32];
const Y_RANGE = [0, 8];
const Z_RANGE = [0, 32];

// The vertical yardstick as it stood before the room's height doubled. Objects written against it
// come back at twice the height they were placed, and ObjectGroup's converter uses this to put them
// back. It stays here, beside the range that replaced it, because the two only mean anything
// together.
const LEGACY_Y_RANGE_MAX = 4;

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

    // Reads a height written against the old vertical yardstick. The stored fraction is the same;
    // only what it is a fraction *of* has changed, so the height it was placed at is recovered by
    // measuring it against the old range instead of the new one.
    static rescaleLegacyY(y: number): number
    {
        return y * (LEGACY_Y_RANGE_MAX / Y_RANGE[1]);
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
