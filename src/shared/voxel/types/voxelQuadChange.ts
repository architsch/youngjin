import VoxelQuad from "./voxelQuad";

export default class VoxelQuadChange
{
    actionType: "add" | "remove" | "changeTexture";
    row: number;
    col: number;
    quadIndex: number;
    facingAxis: "x" | "y" | "z";
    orientation: "-" | "+";
    yOffset: number;
    textureIndex: number;
    voxelQuadsResultSnapshot?: VoxelQuad[];

    constructor(actionType: "add" | "remove" | "changeTexture", row: number, col: number,
        quadIndex: number, facingAxis: "x" | "y" | "z", orientation: "-" | "+",
        yOffset: number, textureIndex: number)
    {
        this.actionType = actionType;
        this.row = row;
        this.col = col;
        this.quadIndex = quadIndex;
        this.facingAxis = facingAxis;
        this.orientation = orientation;
        this.yOffset = yOffset;
        this.textureIndex = textureIndex;
    }

    toString(): string
    {
        return `[(${this.actionType} ${this.row}.${this.col}.${this.quadIndex}) -> ${this.yOffset}.${this.facingAxis}${this.orientation}.${this.textureIndex}]
    -> Result: ${this.voxelQuadsResultSnapshot ? (this.voxelQuadsResultSnapshot.map(quad => `[${quad.yOffset}.${quad.facingAxis}${quad.orientation}.${quad.textureIndex}]`).join(",")) : ""}`;
    }
}