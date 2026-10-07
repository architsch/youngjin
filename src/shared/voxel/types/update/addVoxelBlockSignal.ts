import BufferState from "../../../networking/types/bufferState";
import EncodableByteString from "../../../networking/types/encodableByteString";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRaw4ByteNumber from "../../../networking/types/encodableRaw4ByteNumber";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";
import { NUM_VOXEL_QUADS_PER_COLLISION_LAYER, VOXEL_BLOCK_SHAPE_WHOLE } from "../../../system/sharedConstants";
import VoxelBlockShapeUtil from "../../util/voxelBlockShapeUtil";

export default class AddVoxelBlockSignal extends EncodableData
{
    roomID: string;
    quadIndex: number;
    quadTextureIndicesWithinLayer: number[];
    // The new block's shape (see VoxelBlockShapeUtil).
    shape: number;

    constructor(roomID: string, quadIndex: number, quadTextureIndicesWithinLayer: number[],
        shape: number = VOXEL_BLOCK_SHAPE_WHOLE)
    {
        super();
        this.roomID = roomID;
        this.quadIndex = quadIndex;
        this.quadTextureIndicesWithinLayer = quadTextureIndicesWithinLayer;
        this.shape = shape;
    }

    // The block's six quads go as a room stores them (see Voxel): each one's texture index, with the
    // block's shape in their spare bits.
    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableRaw4ByteNumber(this.quadIndex).encode(bufferState);

        for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
        {
            new EncodableRawByteNumber((this.quadTextureIndicesWithinLayer[i] & 0b01111111) |
                VoxelBlockShapeUtil.getStoredQuadBit(this.shape, i)).encode(bufferState);
        }
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const quadIndex = (EncodableRaw4ByteNumber.decode(bufferState) as EncodableRaw4ByteNumber).n;

        const storedQuads = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
        for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            storedQuads[i] = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;

        // (A shape that isn't one is for whoever applies the signal to refuse; see VoxelUpdateUtil.)
        return new AddVoxelBlockSignal(roomID, quadIndex, storedQuads.map(quad => quad & 0b01111111),
            VoxelBlockShapeUtil.getStoredShape(storedQuads, 0));
    }
}
