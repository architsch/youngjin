import { RoomGenerationVoxelType } from "./roomGenerationVoxelType";

export default class RoomGenerationVoxel
{
    type: RoomGenerationVoxelType;
    row: number;
    col: number;
    textureIndices: [number, number, number, number, number, number]; // [-y, +y, -x, +x, -z, +z]

    constructor(row: number, col: number)
    {
        this.type = RoomGenerationVoxelType.Wall;
        this.row = row;
        this.col = col;
        this.textureIndices = [0, 0, 0, 0, 0, 0];
    }

    getCeilingTextureIndex(): number
    {
        return this.textureIndices[0];
    }
    setCeilingTextureIndex(textureIndex: number)
    {
        this.textureIndices[0] = textureIndex;
    }

    getFloorTextureIndex(): number
    {
        return this.textureIndices[1];
    }
    setFloorTextureIndex(textureIndex: number)
    {
        this.textureIndices[1] = textureIndex;
    }

    setNeighborFacingWallTextureIndex(neighborRow: number, neighborCol: number, textureIndex: number)
    {
        const i = (neighborRow == this.row)
            ? (neighborCol < this.col ? 2 : 3)
            : (neighborRow < this.row ? 4 : 5);
        this.textureIndices[i] = textureIndex;
    }
}