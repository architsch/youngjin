import TextureAtlasRegion from "./textureAtlasRegion";

// Something that shows an entry of a TextureAtlas (see TextureAtlas.acquire).
export default interface TextureAtlasHolder
{
    // The entry's region once its content has been drawn there, or undefined while none is (e.g. during a
    // repack, until the redraw lands).
    onAtlasRegionChanged(region: TextureAtlasRegion | undefined): void;
}
