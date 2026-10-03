import ImageMap from "../../../shared/graphics/image/types/imageMap";
import ImageMapCategory from "../../../shared/graphics/image/types/imageMapCategory";
import ImageMetadata from "../../../shared/graphics/image/types/imageMetadata";
import PictureSearchUtil from "../../../shared/graphics/image/util/pictureSearchUtil";
import { dummyImagesDebugEnabledObservable } from "../../../shared/system/sharedObservables";
import { IMAGE_ALL_TAB_CATEGORY_ORDER } from "../../system/clientConstants";

// The images offered to choose from (see ImageMapThumbnailPanel): alike ones together, narrowed by a category tab
// and a search, and under All laid out category by category.
const ImageChoiceUtil =
{
    // Every image in one of the map's subfolders that may be chosen: a staging one only withStaging, as off the live
    // server (see App.isPublicSite).
    getOffered: (imageMap: ImageMap, subfolderName: string, withStaging: boolean): ImageMetadata[] =>
    {
        return imageMap.getImageMetadataListInSubfolder(subfolderName).filter(image => withStaging || !image.staging);
    },
    // Those, ordered so alike images sit together whatever categories they are in (see orderByKeywords): one order,
    // which a category's tab only narrows.
    getItems: (imageMap: ImageMap, subfolderName: string, withStaging: boolean): ImageMetadata[] =>
    {
        return orderByKeywords(dummyImagesDebugEnabledObservable.peek()
            ? getDummyImageList()
            : ImageChoiceUtil.getOffered(imageMap, subfolderName, withStaging));
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
    // What a tab shows of them: a category's own, in the order they came in; under All, every one, laid out category
    // by category (see orderByCategory).
    getItemsInTab: (imageMap: ImageMap, subfolderName: string, items: ImageMetadata[], tab: string,
        categoryOrder: readonly string[] = IMAGE_ALL_TAB_CATEGORY_ORDER): ImageMetadata[] =>
    {
        const categories = imageMap.getSubfolderCategories(subfolderName);
        if (tab == ImageMap.ALL_TAB)
            return orderByCategory(categories, items, categoryOrder);
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

// A run of images for each tab in the order given, alike images together within it (see orderByKeywords). An image
// under several categories goes with the one listed last (Misc when it is under none), and those under none listed
// come first, as one run.
function orderByCategory(categories: ImageMapCategory[], images: ImageMetadata[],
    categoryOrder: readonly string[]): ImageMetadata[]
{
    if (categories.length == 0)
        return images;
    const tabs = [...categories.map(category => category.name), ImageMap.MISC_TAB];
    const runs = new Map<number, ImageMetadata[]>();
    for (const image of images)
    {
        const place = Math.max(...tabs.filter(tab => isInTab(categories, image, tab))
            .map(tab => categoryOrder.indexOf(tab)));
        const run = runs.get(place);
        if (run != undefined)
            run.push(image);
        else
            runs.set(place, [image]);
    }
    return [...runs.keys()].sort((a, b) => a - b).flatMap(place => orderByKeywords(runs.get(place)!));
}

// Alike images next to each other: clustered by the keywords they share but for their categories (average linkage),
// each merge joining the two runs at their most alike ends. Alphabetical first, so the result doesn't depend on the
// order the images came in.
function orderByKeywords(images: ImageMetadata[]): ImageMetadata[]
{
    const describe = (image: ImageMetadata) => (image.keywords ?? "").split(",")
        .filter(word => !word.endsWith(ImageMap.CATEGORY_MARK)).join(",");
    const sorted = [...images].sort((a, b) => collator.compare(describe(a), describe(b))
        || collator.compare(a.path, b.path));
    const vectors = sorted.map(image => toKeywordVector(describe(image)));
    const similarity = vectors.map(a => vectors.map(b => dot(a, b)));
    // Between clusters, kept under the id of the one a merge keeps.
    const linkage = similarity.map(row => [...row]);
    const clusters = sorted.map((_, index) => ({id: index, run: [index]}));
    while (clusters.length > 1)
    {
        // The most alike pair; the first found on a tie, so the order is the same every time.
        let bestA = 0, bestB = 1;
        for (let a = 0; a < clusters.length; ++a)
        {
            for (let b = a + 1; b < clusters.length; ++b)
            {
                if (linkage[clusters[a].id][clusters[b].id] > linkage[clusters[bestA].id][clusters[bestB].id])
                    [bestA, bestB] = [a, b];
            }
        }
        const clusterA = clusters[bestA], clusterB = clusters[bestB];
        const [runA, runB] = [clusterA.run, clusterB.run];
        let run = [...runA, ...runB];
        for (const [first, second] of [[[...runA].reverse(), runB], [runA, [...runB].reverse()],
            [[...runA].reverse(), [...runB].reverse()]])
        {
            if (similarity[first[first.length - 1]][second[0]] > similarity[run[runA.length - 1]][run[runA.length]])
                run = [...first, ...second];
        }
        for (const other of clusters)
        {
            if (other == clusterA || other == clusterB)
                continue;
            const average = (runA.length * linkage[clusterA.id][other.id] + runB.length * linkage[clusterB.id][other.id])
                / (runA.length + runB.length);
            linkage[clusterA.id][other.id] = linkage[other.id][clusterA.id] = average;
        }
        clusters[bestA] = {id: clusterA.id, run};
        clusters.splice(bestB, 1);
    }
    return (clusters[0]?.run ?? []).map(index => sorted[index]);
}

// Each keyword weighted by its place, as keywords go most important first (the first outweighs the rest together),
// and scaled to unit length so a long list doesn't outweigh a short one.
function toKeywordVector(keywords: string): Map<string, number>
{
    const vector = new Map<string, number>();
    keywords.split(",").map(word => word.trim()).filter(word => word.length > 0)
        .forEach((word, place) => vector.set(word, 1 / (place + 1)));
    const length = Math.hypot(...vector.values()) || 1;
    for (const [word, weight] of vector)
        vector.set(word, weight / length);
    return vector;
}

function dot(a: Map<string, number>, b: Map<string, number>): number
{
    let sum = 0;
    for (const [word, weight] of a)
        sum += weight * (b.get(word) ?? 0);
    return sum;
}

// Fixed to one locale, so every client orders alike; numeric, so "2/9" comes before "2/10".
const collator = new Intl.Collator("en", {numeric: true});

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
