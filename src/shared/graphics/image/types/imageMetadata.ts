export default interface ImageMetadata
{
    // Relative to the map's root directory (rootDirName under assets_url), without extension.
    path: string;

    // What a search finds it by: lowercase, comma-separated (one string ships smaller than an array). Its title and
    // author, which stay in the manifest, when it names none of its own. The categories it is browsed under lead,
    // marked as such (ImageMap.CATEGORY_MARK), and a chooser opens on the first (see ImageChoiceUtil); they are built
    // in from the admin's settings (see ImageMapSettings), and an admin may change them in the game.
    keywords?: string;

    // {subfolderName},{col},{row} (subfolderName is "" without subfolders).
    coords?: string;

    // The image's size in pixels, so it can be laid out before it loads (absent for an atlas map's cells).
    width?: number;
    height?: number;

    // Shown at its own size rather than fitted to what shows it: whole cells of the map's
    // preservedScaleCellSize (see ImageMapSeed), each a fixed patch of the world, and cut off where it overflows.
    preserveScale?: boolean;

    // Built and shipped like any other image, but offered only off the live server, to be tried in the game before
    // everyone can choose it (see ImageChoiceUtil).
    staging?: boolean;

    // Its place in the order a chooser offers its map's images in (see ImageChoiceUtil). Not built: its index in the
    // map's list, kept as the map is registered (see ImageMapUtil.setImageMap), until an admin rearranges them.
    order?: number;
}
