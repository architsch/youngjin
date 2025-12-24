export default class VoxelQuad
{
    facingAxis: "x" | "y" | "z";
    orientation: "-" | "+";
    yOffset: number;
    textureIndex: number;

    constructor(facingAxis: "x" | "y" | "z", orientation: "-" | "+", yOffset: number, textureIndex: number)
    {
        this.facingAxis = facingAxis;
        this.orientation = orientation;
        this.yOffset = yOffset;
        this.textureIndex = textureIndex;
    }
}