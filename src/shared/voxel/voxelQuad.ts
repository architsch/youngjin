export default interface VoxelQuad
{
    facingAxis: "x" | "y" | "z";
    orientation: "-" | "+";
    yOffset: number;
    textureIndex: number;
}