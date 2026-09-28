import TextureAtlasRegion from "./textureAtlasRegion";

// Hands out rectangles of cells from one atlas and takes them back, like malloc in two dimensions.
// Placement is "contact point" packing: a region goes where its border touches the most taken cells and
// atlas edges (ties to the lowest row, then column). Regions settle into flush blocks that way, rather than
// leaving slivers that later regions don't fit into.
export default class TextureAtlasAllocator
{
    readonly numCols: number;
    readonly numRows: number;
    private readonly taken: Uint8Array; // one per cell, row-major from the bottom row

    constructor(numCols: number, numRows: number)
    {
        this.numCols = numCols;
        this.numRows = numRows;
        this.taken = new Uint8Array(numCols * numRows);
    }

    // Undefined when no free rectangle of that size exists, although one may after the others are packed
    // again from scratch (clear, then allocate them largest first).
    allocate(numCols: number, numRows: number): TextureAtlasRegion | undefined
    {
        if (numCols < 1 || numRows < 1 || numCols > this.numCols || numRows > this.numRows)
            return undefined;

        let best: TextureAtlasRegion | undefined;
        let bestContact = -1;
        for (let row = 0; row + numRows <= this.numRows; ++row)
        {
            for (let col = 0; col + numCols <= this.numCols; ++col)
            {
                if (!this.isFree(col, row, numCols, numRows))
                    continue;
                const contact = this.getContact(col, row, numCols, numRows);
                if (contact > bestContact)
                {
                    bestContact = contact;
                    best = {col, row, numCols, numRows};
                }
            }
        }
        if (best != undefined)
            this.fill(best, 1);
        return best;
    }

    free(region: TextureAtlasRegion): void
    {
        this.fill(region, 0);
    }

    clear(): void
    {
        this.taken.fill(0);
    }

    getNumFreeCells(): number
    {
        let numFree = 0;
        for (let i = 0; i < this.taken.length; ++i)
            numFree += 1 - this.taken[i];
        return numFree;
    }

    private isFree(col: number, row: number, numCols: number, numRows: number): boolean
    {
        for (let r = row; r < row + numRows; ++r)
        {
            for (let c = col; c < col + numCols; ++c)
            {
                if (this.taken[r * this.numCols + c] != 0)
                    return false;
            }
        }
        return true;
    }

    // How many cells just outside the rectangle's border are taken or beyond the atlas's edge.
    private getContact(col: number, row: number, numCols: number, numRows: number): number
    {
        let contact = 0;
        for (let c = col; c < col + numCols; ++c)
            contact += this.blocks(c, row - 1) + this.blocks(c, row + numRows);
        for (let r = row; r < row + numRows; ++r)
            contact += this.blocks(col - 1, r) + this.blocks(col + numCols, r);
        return contact;
    }

    private blocks(col: number, row: number): number
    {
        if (col < 0 || row < 0 || col >= this.numCols || row >= this.numRows)
            return 1;
        return this.taken[row * this.numCols + col];
    }

    private fill(region: TextureAtlasRegion, value: number): void
    {
        for (let r = region.row; r < region.row + region.numRows; ++r)
            this.taken.fill(value, r * this.numCols + region.col, r * this.numCols + region.col + region.numCols);
    }
}
