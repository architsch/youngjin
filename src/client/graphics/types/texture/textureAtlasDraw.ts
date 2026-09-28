import TextureAtlasRegion from "./textureAtlasRegion";

// Draws an entry's content into the region the TextureAtlas has given it; it may finish later (e.g. once an
// image has loaded), and must then check isCurrent just before writing, since by then the region may be
// another entry's.
type TextureAtlasDraw = (region: TextureAtlasRegion, isCurrent: () => boolean) => void | Promise<void>;

export default TextureAtlasDraw;
