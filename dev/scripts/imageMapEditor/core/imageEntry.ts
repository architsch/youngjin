// One image of the map, as its manifest lists it (the builder reads path, author, title, keywords, preserveScale and
// disabled).
export default interface ImageEntry
{
    path: string;
    author: string;
    title: string;
    // What a search finds it by: lowercase single words, comma-separated, none found inside another and none a filler
    // word (see PICTURE_SEARCH_FILLER_WORDS), most important first, its categories leading (see
    // ImageMetadata.keywords). Absent, it is found by its title and author, as a painting is; an everyday object names
    // its own.
    keywords?: string;
    preserveScale?: boolean;
    // Where a third party's image came from, and the terms it is used under (see IMAGE_LICENSES); both absent
    // for original artwork.
    source?: string;
    license?: string;
    // Left out of the built map, so out of the game, while keeping its path; its game image is parked where it
    // doesn't ship (see EditorPaths.disabledImagesDir).
    disabled?: boolean;
}
