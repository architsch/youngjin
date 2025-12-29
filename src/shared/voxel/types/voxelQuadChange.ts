export default class VoxelQuadChange
{
    row: number;
    col: number;
    facingAxis: "x" | "y" | "z";
    orientation: "-" | "+";
    collisionLayer: number;
    oldQuad: number;
    newQuad: number;
    voxelQuadsResultSnapshot?: string[];

    constructor(row: number, col: number, facingAxis: "x" | "y" | "z", orientation: "-" | "+",
        collisionLayer: number, oldQuad: number, newQuad: number)
    {
        this.row = row;
        this.col = col;
        this.facingAxis = facingAxis;
        this.orientation = orientation;
        this.collisionLayer = collisionLayer;
        this.oldQuad = oldQuad;
        this.newQuad = newQuad;
    }

    toString(): string
    {
        const showQuadOld = (this.oldQuad & 0b10000000) != 0;
        const textureIndexOld = this.oldQuad & 0b01111111;
        const showQuadNew = (this.newQuad & 0b10000000) != 0;
        const textureIndexNew = this.newQuad & 0b01111111;
        return `[(row:${this.row}, col:${this.col}) ${this.orientation}${this.facingAxis}.${this.collisionLayer} (${showQuadOld ? "show" : "hide"} ${textureIndexOld} -> ${showQuadNew ? "show" : "hide"} ${textureIndexNew})]
    -> Result: ${JSON.stringify(this.voxelQuadsResultSnapshot)}`;
    }
}