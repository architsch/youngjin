import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import Vec3 from "../../math/types/vec3";
import { MAX_ROOM_Y, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import Encodable2ByteVec3 from "../../networking/types/encodable2ByteVec3";

const xRange = [0, NUM_VOXEL_COLS]; // from start to end of the voxel grid
const yRange = [0, MAX_ROOM_Y]; // from floor to ceiling
const zRange = [0, NUM_VOXEL_ROWS]; // from start to end of the voxel grid
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

    encode(bufferState: BufferState)
    {
        new Encodable2ByteVec3(this.pos,
            xRange[0], xRange[1],
            yRange[0], yRange[1],
            zRange[0], zRange[1],).encode(bufferState);

        new Encodable2ByteVec3(this.dir,
            dirVecRange[0], dirVecRange[1],
            dirVecRange[0], dirVecRange[1],
            dirVecRange[0], dirVecRange[1]).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const posData = Encodable2ByteVec3.decodeWithParams(bufferState,
            xRange[0], xRange[1],
            yRange[0], yRange[1],
            zRange[0], zRange[1]) as Encodable2ByteVec3;

        const dirData = Encodable2ByteVec3.decodeWithParams(bufferState,
            dirVecRange[0], dirVecRange[1],
            dirVecRange[0], dirVecRange[1],
            dirVecRange[0], dirVecRange[1]) as Encodable2ByteVec3;

        return new ObjectTransform(posData.v, dirData.v);
    }
}