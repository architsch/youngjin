import ImageMap from "../../../shared/graphics/image/types/imageMap";
import ImageMapCategory from "../../../shared/graphics/image/types/imageMapCategory";
import ImageMapSettings from "../../../shared/graphics/image/types/imageMapSettings";
import ImageMetadata from "../../../shared/graphics/image/types/imageMetadata";
import ImageMapSettingsUtil from "../../../shared/graphics/image/util/imageMapSettingsUtil";
import PictureSearchUtil from "../../../shared/graphics/image/util/pictureSearchUtil";
import { dummyImagesDebugEnabledObservable } from "../../../shared/system/sharedObservables";

// The images offered to choose from (see ImageMapThumbnailPanel): in the order their map lists them in, narrowed by
// a category tab and a search. An admin may rearrange them, file each under other categories, and change what
// categories there are (see AdminAssetSettingsEditor).
const ImageChoiceUtil =
{
    // Every image in one of the map's subfolders that may be chosen: a staging one only withStaging, as off the live
    // server (see App.isPublicSite).
    getOffered: (imageMap: ImageMap, subfolderName: string, withStaging: boolean): ImageMetadata[] =>
    {
        return imageMap.getImageMetadataListInSubfolder(subfolderName).filter(image => withStaging || !image.staging);
    },
    // Those, in order (see ImageMetadata.order): one order, which a tab or a search only narrows.
    getItems: (imageMap: ImageMap, subfolderName: string, withStaging: boolean): ImageMetadata[] =>
    {
        if (dummyImagesDebugEnabledObservable.peek())
            return getDummyImageList();
        return ImageChoiceUtil.getOffered(imageMap, subfolderName, withStaging).sort(compareOrder);
    },
    // All, then each category holding any of the images, and Misc if any names none of them; no tabs for a subfolder
    // listing no categories.
    getCategoryTabs: (imageMap: ImageMap, subfolderName: string, items: ImageMetadata[]): string[] =>
    {
        const categories = imageMap.getSubfolderCategories(subfolderName);
        if (categories.length == 0)
            return [];
        const tabs = [...categories.map(category => category.name), ImageMap.MISC_TAB];
        return [ImageMap.ALL_TAB, ...tabs.filter(tab => items.some(item => isInTab(categories, item, tab)))];
    },
    // What a tab shows of them, in the order they came in: a category's own, or every one under All.
    getItemsInTab: (imageMap: ImageMap, subfolderName: string, items: ImageMetadata[], tab: string): ImageMetadata[] =>
    {
        const categories = imageMap.getSubfolderCategories(subfolderName);
        return items.filter(item => isInTab(categories, item, tab));
    },
    // The tab to open on for an image: the category its foremost keyword names, or Misc if that names none (the
    // categories come first). All when the map doesn't hold it, or its subfolder lists no categories.
    getFirstCategoryTab: (imageMap: ImageMap, subfolderName: string, path: string): string =>
    {
        const categories = imageMap.getSubfolderCategories(subfolderName);
        if (categories.length == 0 || !imageMap.hasImagePathInSubfolder(path, subfolderName))
            return ImageMap.ALL_TAB;
        const foremost = (imageMap.getImageMetadataByPath(path).keywords ?? "").split(",")[0];
        return categories.find(category => category.name + ImageMap.CATEGORY_MARK == foremost)?.name
            ?? ImageMap.MISC_TAB;
    },
    // The images whose keywords hold every word typed (see PictureSearchUtil). A staging image is found by "staging"
    // too.
    getFilteredItems: (allItems: ImageMetadata[],
        searchInput: string): ImageMetadata[] =>
    {
        return PictureSearchUtil.filter(allItems, searchInput, getSearchedWords);
    },
    // Every image of a subfolder, offered or not, in order: what an admin arranges.
    getOrdered: (imageMap: ImageMap, subfolderName: string): ImageMetadata[] =>
    {
        return imageMap.getImageMetadataListInSubfolder(subfolderName).sort(compareOrder);
    },
    // Puts an image at a place in its subfolder's order (see getOrdered). Every other image keeps its place among
    // the rest.
    moveItem: (imageMap: ImageMap, path: string, position: number): void =>
    {
        const ordered = ImageChoiceUtil.getOrdered(imageMap, ImageMap.getSubfolderName(path));
        const from = ordered.findIndex(image => image.path == path);
        if (from < 0)
            return;
        // The subfolder's own places in the map's order, handed out again.
        const places = ordered.map(image => image.order);
        ordered.splice(position, 0, ...ordered.splice(from, 1));
        ordered.forEach((image, index) => image.order = places[index]);
    },
    // The categories an image is filed under, in order: the first is the tab a chooser opens on for it.
    getCategories: (imageMap: ImageMap, path: string): string[] =>
    {
        return ImageMap.getCategories(imageMap.getImageMetadataByPath(path).keywords);
    },
    // How many of a subfolder's images are filed under each of its categories, offered or not. One holding none is
    // left out.
    getNumFiled: (imageMap: ImageMap, subfolderName: string): Map<string, number> =>
    {
        const numFiled = new Map<string, number>();
        for (const image of imageMap.getImageMetadataListInSubfolder(subfolderName))
        {
            for (const name of ImageMap.getCategories(image.keywords))
                numFiled.set(name, (numFiled.get(name) ?? 0) + 1);
        }
        return numFiled;
    },
    // Files it under these instead, for every chooser of the map.
    setCategories: (imageMap: ImageMap, path: string, categories: string[]): void =>
    {
        const image = imageMap.getImageMetadataByPath(path);
        image.keywords = ImageMap.withCategories(image.keywords, categories);
    },
    // Lists a category after a subfolder's others, for every chooser of the map. Returns why it can't be, if it
    // can't (see ImageMapSettingsUtil.getCategoryProblem).
    addCategory: (imageMap: ImageMap, subfolderName: string, category: ImageMapCategory): string | undefined =>
    {
        const categories = imageMap.getSubfolderCategories(subfolderName);
        const problem = ImageMapSettingsUtil.getCategoryProblem(category, categories);
        if (problem == undefined)
            imageMap.setSubfolderCategories(subfolderName, [...categories, category]);
        return problem;
    },
    // Makes one of a subfolder's categories another, in its place, every image filed under it following. Returns
    // why it can't be, if it can't.
    renameCategory: (imageMap: ImageMap, subfolderName: string, name: string,
        category: ImageMapCategory): string | undefined =>
    {
        const categories = imageMap.getSubfolderCategories(subfolderName);
        const problem = ImageMapSettingsUtil.getCategoryProblem(category, categories.filter(other => other.name != name));
        if (problem != undefined)
            return problem;
        imageMap.setSubfolderCategories(subfolderName, categories.map(other => (other.name == name) ? category : other));
        if (category.name != name)
            refile(imageMap, subfolderName, name, category.name);
        return undefined;
    },
    // Puts one of a subfolder's categories at a place in their order, which is their tabs', for every chooser of
    // the map. No image's own categories change.
    moveCategory: (imageMap: ImageMap, subfolderName: string, name: string, position: number): void =>
    {
        const categories = [...imageMap.getSubfolderCategories(subfolderName)];
        const from = categories.findIndex(category => category.name == name);
        if (from < 0)
            return;
        categories.splice(position, 0, ...categories.splice(from, 1));
        imageMap.setSubfolderCategories(subfolderName, categories);
    },
    // Does away with one of a subfolder's categories, taking every image filed under it out of it.
    removeCategory: (imageMap: ImageMap, subfolderName: string, name: string): void =>
    {
        imageMap.setSubfolderCategories(subfolderName,
            imageMap.getSubfolderCategories(subfolderName).filter(other => other.name != name));
        refile(imageMap, subfolderName, name);
    },
    // The categories, the order and each image's own categories as the settings file holds them, for an admin to
    // save over that file's (see AdminAssetSettings).
    getSettings: (imageMap: ImageMap): ImageMapSettings =>
    {
        const categoryTabsBySubfolder: {[subfolderName: string]: ImageMapCategory[]} = {};
        for (const subfolderName of imageMap.getSubfolderNames())
            categoryTabsBySubfolder[subfolderName] = imageMap.getSubfolderCategories(subfolderName);
        return ImageMapSettingsUtil.fromImages([...imageMap.getImageMetadataList()].sort(compareOrder),
            categoryTabsBySubfolder);
    },
    // getSettings the other way: offers the map as built with these settings, whatever was set before. A subfolder
    // they leave out lists no categories; an image they leave out is under none, and comes before those they list.
    applySettings: (imageMap: ImageMap, settings: ImageMapSettings): void =>
    {
        for (const subfolderName of imageMap.getSubfolderNames())
            imageMap.setSubfolderCategories(subfolderName, settings.categoryTabsBySubfolder[subfolderName] ?? []);
        const images = imageMap.getImageMetadataList();
        for (const image of images)
        {
            // Only the categories its subfolder lists.
            const listed = imageMap.getSubfolderCategories(ImageMap.getSubfolderName(image.path));
            image.keywords = ImageMap.withCategories(image.keywords, ImageMapSettingsUtil.getCategories(settings, image.path)
                .filter(name => listed.some(category => category.name == name)));
        }
        // The map's list is as built, so its places are handed out again from there.
        ImageMapSettingsUtil.sort(images, settings).forEach((image, place) => image.order = place);
    },
}

// Files every image of a subfolder that is under a category, offered or not, under another in its place, or takes
// it out of that one when given no other.
function refile(imageMap: ImageMap, subfolderName: string, name: string, replacement?: string): void
{
    for (const image of imageMap.getImageMetadataListInSubfolder(subfolderName))
    {
        const filedUnder = ImageMap.getCategories(image.keywords);
        if (!filedUnder.includes(name))
            continue;
        image.keywords = ImageMap.withCategories(image.keywords, (replacement != undefined)
            ? filedUnder.map(other => (other == name) ? replacement : other)
            : filedUnder.filter(other => other != name));
    }
}

// One a map never registered has no place of its own, and keeps the one it came in.
function compareOrder(a: ImageMetadata, b: ImageMetadata): number
{
    return (a.order ?? 0) - (b.order ?? 0);
}

// Under each category its keywords name as one, or Misc when they name none.
function isInTab(categories: ImageMapCategory[], image: ImageMetadata, tab: string): boolean
{
    if (tab == ImageMap.ALL_TAB)
        return true;
    const words = (image.keywords ?? "").split(",");
    return (tab == ImageMap.MISC_TAB)
        ? !categories.some(category => words.includes(category.name + ImageMap.CATEGORY_MARK))
        : words.includes(tab + ImageMap.CATEGORY_MARK);
}

// Found by a search as though it were one of every staging image's keywords, so it lists them all.
const STAGING_SEARCH_WORD = "staging";

function getSearchedWords(image: ImageMetadata): string
{
    return image.staging ? `${image.keywords ?? ""},${STAGING_SEARCH_WORD}` : (image.keywords ?? "");
}

// Dummy total for testing pagination in debug mode.
const DEBUG_DUMMY_IMAGE_TOTAL = 200;

const cachedDummyImageList: ImageMetadata[] = [];

function getDummyImageList(): ImageMetadata[]
{
    if (cachedDummyImageList.length > 0)
        return cachedDummyImageList;

    const randomTitleWords = ["Dawn", "Meadow", "Brook", "Creek", "Sunset", "Moon", "Park", "City", "Valley", "Rose", "Garden", "Room", "Light", "Day", "Night", "Spirit", "Myth", "Lake", "Silver", "Golden", "Haze", "Candle", "Time", "Space", "Village", "Blue", "Rainbow", "Hill", "Crow"];
    const randomFirstNames = ["Sarah", "John", "Jack", "Leah", "Paul", "Arthur", "Vincent", "Nathan", "Peter", "Ralph", "Rebecca", "Becky", "Abraham", "Nick", "Jordan", "Hunter", "George", "Bernard", "David", "Daniel", "Kelly", "Andrew"];
    const randomLastNames = ["Shannon", "Monet", "Gogh", "Smith", "Willis", "Russell", "Nicholson", "Anderson", "Morris", "Henderson", "Conger", "Black", "Thompson", "Shaw", "Morrow", "Preston", "Rowland", "Mackey", "Beck"];
    const pickRandom = (list: string[]): string => list[Math.floor(Math.random() * list.length)];
    const generatePlaceholderText = (maxNumPads: number): string =>
        (maxNumPads == 0 || Math.random() < 0.75) ?
            "" : "Placeholder " + generatePlaceholderText(maxNumPads-1);

    for (let i = 0; i < DEBUG_DUMMY_IMAGE_TOTAL; ++i)
    {
        const title = `${pickRandom(randomTitleWords)} ${pickRandom(randomTitleWords)} (${i+1}) ${generatePlaceholderText(10)}`.trim();
        const author = `${pickRandom(randomFirstNames)} ${pickRandom(randomLastNames)} ${generatePlaceholderText(10)}`.trim();
        cachedDummyImageList.push({
            path: `1/${i + 1}`,
            keywords: `${title},${author}`.toLowerCase(),
            coords: "0,0,0",
        });
    }
    return cachedDummyImageList;
}

export default ImageChoiceUtil;
