import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"

export default class VoxelQuad extends EncodableData
{
    facingAxis: "x" | "y" | "z";
    orientation: "-" | "+";
    yOffset: number;
    textureIndex: number;

    constructor(facingAxis: "x" | "y" | "z", orientation: "-" | "+", yOffset: number, textureIndex: number)
    {
        super();
        this.facingAxis = facingAxis;
        this.orientation = orientation;
        this.yOffset = yOffset;
        this.textureIndex = textureIndex;
    }

    encode(bufferState: BufferState)
    {
        if (this.textureIndex < 0 || this.textureIndex > 63)
            throw new Error(`VoxelQuad's texture index is out of range (range = [0,63])`);

        // Quad Byte 1
        bufferState.view[bufferState.index++] =
            (((this.facingAxis == "x") ? 0b00 : (this.facingAxis == "y" ? 0b01 : 0b10)) << 6) |
            ((this.orientation == "-" ? 0b0 : 0b1) << 5) |
            ((Math.round(this.yOffset * 2) & 0b111) << 2);
        
        // Quad Byte 2
        bufferState.view[bufferState.index++] =
            ((this.textureIndex & 0b111111) << 2);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        // Quad Byte 1
        const quadByte1 = bufferState.view[bufferState.index++];
        const facingAxisRaw = (quadByte1 >> 6) & 0b11;
        const facingAxis = (facingAxisRaw == 0b00) ? "x" : (facingAxisRaw == 0b01 ? "y" : "z");
        const orientationRaw = (quadByte1 >> 5) & 0b1;
        const orientation = (orientationRaw == 0b0) ? "-" : "+";
        const yOffsetRaw = (quadByte1 >> 2) & 0b111;
        const yOffset = yOffsetRaw * 0.5;

        // Quad Byte 2
        const quadByte2 = bufferState.view[bufferState.index++];
        const textureIndex = (quadByte2 >> 2) & 0b111111;

        return new VoxelQuad(facingAxis, orientation, yOffset, textureIndex);
    }
}