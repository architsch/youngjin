// The set of voxel textures one region of a generated room is finished in. Keeping them
// together is what makes a region read as a single deliberately decorated space rather than a
// patchwork: a generator only ever draws whole palettes, never individual textures.
export default interface RoomGenerationPalette
{
    floorTextureIndex: number;
    ceilingTextureIndex: number;
    wallTextureIndex: number;
    propTextureIndex: number; // for the free-standing decorations placed inside the region
}
