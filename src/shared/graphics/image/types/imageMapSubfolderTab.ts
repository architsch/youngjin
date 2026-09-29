import ImageMapCategory from "./imageMapCategory";

// A subfolder as a chooser tab, listed in a map's manifest in the order the tabs appear.
export default interface ImageMapSubfolderTab
{
    name: string;
    title: string;
    // The categories its images are browsed by, in the order their tabs appear. An image is in each one its keywords
    // name as a category (ImageMap.CATEGORY_MARK), and those come first; one naming none is under Misc
    // (ImageMap.MISC_TAB).
    categories?: ImageMapCategory[];
}
