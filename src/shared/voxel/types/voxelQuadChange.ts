import { getVoxelColFromQuadIndex, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadOrientationFromQuadIndex, getVoxelRowFromQuadIndex } from "../util/voxelQueryUtil";

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
        const row = getVoxelRowFromQuadIndex(this.quadIndex);
        const col = getVoxelColFromQuadIndex(this.quadIndex);
        const facingAxis = getVoxelQuadFacingAxisFromQuadIndex(this.quadIndex);
        const orientation = getVoxelQuadOrientationFromQuadIndex(this.quadIndex);
        const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(this.quadIndex);
        const showQuad = (this.newQuad & 0b10000000) != 0;
        const textureIndex = this.newQuad & 0b01111111;
        return `(${row},${col}) ${orientation}${facingAxis} at ${collisionLayer} ---> ${showQuad ? "show" : "hide"} texture ${textureIndex}
    Result: ${this.voxelQuadsResultSnapshot || "(?)"}`;
    }
}