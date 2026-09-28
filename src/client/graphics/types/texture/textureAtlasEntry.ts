import TextureAtlasDraw from "./textureAtlasDraw";
import TextureAtlasHolder from "./textureAtlasHolder";
import TextureAtlasRegion from "./textureAtlasRegion";

// One key's content in a TextureAtlas.
export default interface TextureAtlasEntry
{
    key: string;
    draw: TextureAtlasDraw;
    // The size in cells each holder asks for; the entry takes the largest.
    sizeByHolder: Map<TextureAtlasHolder, {numCols: number, numRows: number}>;
    // Drawn, and shown by the holders.
    region: TextureAtlasRegion | undefined;
    // Being drawn, to replace region once the draw lands.
    pendingRegion: TextureAtlasRegion | undefined;
    // The size region (or pendingRegion) was asked for, which is more than it has when it was shrunk to fit.
    allocatedFor: {numCols: number, numRows: number} | undefined;
    // Bumped by every draw, so one that lands after a later one started is dropped.
    drawGeneration: number;
}
