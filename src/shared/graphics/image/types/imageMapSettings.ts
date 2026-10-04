import ImageMapCategory from "./imageMapCategory";

// What an admin sets about an image map's images (see AdminAssetSettings), each named by the number its path ends in
// ("2/96" is 96 of "2"). A number naming no image of the map is passed over.
export default interface ImageMapSettings
{
    // The categories each subfolder's images are browsed by, in the order their tabs appear. A subfolder left out
    // has none.
    categoryTabsBySubfolder: {[subfolderName: string]: ImageMapCategory[]};
    // The order the map lists each subfolder's images in. An image left out comes before every one listed.
    orderedIndicesBySubfolder: {[subfolderName: string]: number[]};
    // The categories each image is browsed under, by name, the first being the tab a chooser opens on for it. An
    // image left out has none, and a category its subfolder doesn't list is passed over.
    categoriesBySubfolderAndIndex: {[subfolderName: string]: {[index: string]: string[]}};
}
