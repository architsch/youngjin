import ImageMap from "../../../shared/graphics/image/types/imageMap";
import ImageMetadata from "../../../shared/graphics/image/types/imageMetadata";
import { dummyImagesDebugEnabledObservable } from "../../../shared/system/sharedObservables";
import { PICTURE_SEARCH_FILLER_WORDS } from "../../../shared/system/sharedConstants";

// The images offered to choose from (see ImageMapThumbnailPanel): shuffled, narrowed by a search, and shown a page
// at a time.
const ImageChoiceUtil =
{
    // A shuffled copy of every image in one of the map's subfolders, with the selected one first when it is among
    // them.
    getShuffledItems: (imageMap: ImageMap, subfolderName: string, selectedPath: string): ImageMetadata[] =>
    {
        const allItems = dummyImagesDebugEnabledObservable.peek()
            ? [...getDummyImageList()]
            : [...imageMap.getImageMetadataListInSubfolder(subfolderName)];

        // Shuffle
        for (let i = allItems.length-1; i >= 1; --i)
        {
            const randIndex = Math.floor(Math.random() * (i+1));
            const temp = allItems[randIndex];
            allItems[randIndex] = allItems[i];
            allItems[i] = temp;
        }
        // Move the selected item to the front.
        const selectedIndex = allItems.findIndex(metadata => metadata.path === selectedPath);
        if (selectedIndex > 0)
        {
            const temp = allItems[0];
            allItems[0] = allItems[selectedIndex];
            allItems[selectedIndex] = temp;
        }

        return allItems;
    },
    // The images whose keywords hold every word typed, anywhere in them (so "red crate" finds "crate,red,pepper"),
    // but for filler words ("and", "of"), which keywords leave out.
    getFilteredItems: (allItems: ImageMetadata[],
        searchInput: string): ImageMetadata[] =>
    {
        const terms = searchInput.toLowerCase().split(/[\s,]+/)
            .filter(term => term.length > 0 && !PICTURE_SEARCH_FILLER_WORDS.includes(term));
        if (terms.length === 0)
            return allItems;
        return allItems.filter(metadata => terms.every(term => isFound(metadata.keywords ?? "", term)));
    },
    getPageItems: (filteredItems: ImageMetadata[], pageIndex: number): ImageMetadata[] =>
    {
        return filteredItems.slice(0, (pageIndex + 1) * PAGE_SIZE);
    },
    hasMore: (filteredItems: ImageMetadata[], pageIndex: number): boolean =>
    {
        // (pageIndex + 1) * PAGE_SIZE = "First item of the next page"
        return (pageIndex + 1) * PAGE_SIZE < filteredItems.length;
    },
}

// Thumbnails mounted per page; mounting thousands at once (and requesting their images) doesn't scale.
const PAGE_SIZE = 30;

// As typed, or as its singular, since keywords are singular ("peppers", "boxes"); too short a word is left as is,
// or it would find far too much.
function isFound(keywords: string, term: string): boolean
{
    if (keywords.includes(term))
        return true;
    if (term.length <= 3 || !term.endsWith("s"))
        return false;
    return keywords.includes(term.slice(0, -1)) || (term.endsWith("es") && keywords.includes(term.slice(0, -2)));
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
