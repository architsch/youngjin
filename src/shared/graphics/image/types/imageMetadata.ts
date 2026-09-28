export default interface ImageMetadata
{
    // Relative to the map's root directory (rootDirName under assets_url), without extension.
    path: string;

    // What a search finds it by: lowercase, comma-separated (one string ships smaller than an array). Its title and
    // author, which stay in the manifest, when it names none of its own.
    keywords?: string;

    // {subfolderName},{col},{row} (subfolderName is "" without subfolders).
    coords?: string;

    // The image's size in pixels, so it can be laid out before it loads (absent for an atlas map's cells).
    width?: number;
    height?: number;

    // Shown at its own size rather than fitted to what shows it: whole cells of the map's
    // preservedScaleCellSize (see ImageMapSeed), each a fixed patch of the world, and cut off where it overflows.
    preserveScale?: boolean;
}
