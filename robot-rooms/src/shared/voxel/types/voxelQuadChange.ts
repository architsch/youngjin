import VoxelQueryUtil from "../util/voxelQueryUtil";

export default class VoxelQuadChange
{
    quadIndex: number;
    newQuad: number;
    voxelQuadsResultSnapshot?: string;

    constructor(quadIndex: number, newQuad: number)
    {
        this.quadIndex = quadIndex;
        this.newQuad = newQuad;
    }

    toString(): string
    {
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(this.quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(this.quadIndex);
        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(this.quadIndex);
        const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(this.quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(this.quadIndex);
        const textureIndex = this.newQuad & 0b01111111;
        return `(${row},${col}) ${orientation}${facingAxis} at ${collisionLayer} ---> texture ${textureIndex}
    Result: ${this.voxelQuadsResultSnapshot || "(?)"}`;
    }
}