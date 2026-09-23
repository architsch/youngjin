// A rectangle of whole cells in a texture atlas (see TextureAtlasAllocator). Rows count up from the
// texture's bottom edge (V up), as texture cells do elsewhere (see InstancedMeshBinding).
export default interface TextureAtlasRegion
{
    col: number;
    row: number;
    numCols: number;
    numRows: number;
}
