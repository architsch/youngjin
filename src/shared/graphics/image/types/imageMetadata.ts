export default interface ImageMetadata
{
    // Relative to the map's root directory (rootDirName under assets_url), without extension.
    path: string;

    author: string;
    title: string;

    // {subfolderName},{col},{row} (subfolderName is "" without subfolders).
    coords?: string;
}