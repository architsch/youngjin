import BufferState from "../../../networking/types/bufferState";
import EncodableByteString from "../../../networking/types/encodableByteString";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRaw2ByteNumber from "../../../networking/types/encodableRaw2ByteNumber";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";
import { NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../../system/sharedConstants";

export default class AddVoxelBlockSignal extends EncodableData
{
    roomID: string;
    quadIndex: number;
    quadTextureIndicesWithinLayer: number[];

    constructor(roomID: string, quadIndex: number, quadTextureIndicesWithinLayer: number[])
    {
        super();
        this.roomID = roomID;
        this.quadIndex = quadIndex;
        this.quadTextureIndicesWithinLayer = quadTextureIndicesWithinLayer;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableRaw2ByteNumber(this.quadIndex).encode(bufferState);

        for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            new EncodableRawByteNumber(this.quadTextureIndicesWithinLayer[i]).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const quadIndex = (EncodableRaw2ByteNumber.decode(bufferState) as EncodableRaw2ByteNumber).n;

        const quadTextureIndicesWithinLayer = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
        for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            quadTextureIndicesWithinLayer[i] = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;

        return new AddVoxelBlockSignal(roomID, quadIndex, quadTextureIndicesWithinLayer);
    }
}
