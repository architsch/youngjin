import { getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadOrientationFromQuadIndex } from "../util/voxelQueryUtil";

export default class VoxelQuadChange
{
    row: number;
    col: number;
    newCollisionLayerMask: number;
    quadIndex: number;
    newQuad: number;
    voxelQuadsResultSnapshot?: string[];

    constructor(row: number, col: number, newCollisionLayerMask: number, quadIndex: number, newQuad: number)
    {
        this.row = row;
        this.col = col;
        this.newCollisionLayerMask = newCollisionLayerMask;
        this.quadIndex = quadIndex;
        this.newQuad = newQuad;
    }

    toString(): string
    {
        const facingAxis = getVoxelQuadFacingAxisFromQuadIndex(this.quadIndex);
        const orientation = getVoxelQuadOrientationFromQuadIndex(this.quadIndex);
        const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(this.newCollisionLayerMask, this.quadIndex);
        const showQuad = (this.newQuad & 0b10000000) != 0;
        const textureIndex = this.newQuad & 0b01111111;
        return `[(row:${this.row}, col:${this.col}, ind:${this.quadIndex}) -> ${orientation}${facingAxis}.${collisionLayer} (${showQuad ? "show" : "hide"} ${textureIndex})]
    -> Result: ${JSON.stringify(this.voxelQuadsResultSnapshot)}`;
    }
}