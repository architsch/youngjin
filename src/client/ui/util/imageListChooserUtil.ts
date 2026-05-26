import ImageMap from "../../../shared/image/types/imageMap";
import ImageMetadata from "../../../shared/image/types/imageMetadata";
import { imageListChooserDebugEnabledObservable } from "../../../shared/system/sharedObservables";

const ImageListChooserUtil =
{
    getShuffledAllItems: (imageMap: ImageMap, selectedPath: string): ImageMetadata[] =>
    {
        const allItems = imageListChooserDebugEnabledObservable.peek()
            ? getDummyImageList()
            : imageMap.getImageMetadataList();
        
        // Shuffle
        for (let i = allItems.length-1; i >= 1; --i)
        {
            const randIndex = Math.floor(Math.random() * (i+1));
            const temp = allItems[randIndex];
            allItems[randIndex] = allItems[i];
            allItems[i] = temp;
        }
        // Bring the selected item to the top of the list
        // (so that the user will be able to see the currently selected item
        // right at the top of the list)
        const selectedIndex = getImageIndexAtPath(allItems, selectedPath);
        const temp = allItems[0];
        allItems[0] = allItems[selectedIndex];
        allItems[selectedIndex] = temp;

        return allItems;
    },
    getFilteredItems: (allItems: ImageMetadata[],
        searchInput: string): ImageMetadata[] =>
    {
        const query = searchInput.trim().toLowerCase();
        if (query.length === 0)
            return allItems;
        return allItems.filter(metadata =>
            metadata.title.toLowerCase().includes(query) ||
            metadata.author.toLowerCase().includes(query));
    },
    getPageItems: (filteredItems: ImageMetadata[], pageIndex: number): ImageMetadata[] =>
    {
        return filteredItems.slice(0, (pageIndex + 1) * PAGE_SIZE);
    },
    getInitialPageIndex: (filteredItems: ImageMetadata[], selectedPath: string,
        searchInput: string): number =>
    {
        const query = searchInput.trim().toLowerCase();
        if (query.length === 0)
            return getPageIndexAtSelectedPath(filteredItems, selectedPath);
        else
            return 0;
    },
    hasMore: (filteredItems: ImageMetadata[], pageIndex: number): boolean =>
    {
        // (pageIndex + 1) * PAGE_SIZE = "First item of the next page"
        return (pageIndex + 1) * PAGE_SIZE < filteredItems.length;
    },
}

function getPageIndexAtSelectedPath(filteredItems: ImageMetadata[], selectedPath: string): number
{
    const selectedImageIndex = getImageIndexAtPath(filteredItems, selectedPath);
    return Math.floor(selectedImageIndex / PAGE_SIZE);
}

function getImageIndexAtPath(items: ImageMetadata[], path: string): number
{
    let index = 0;
    for (let i = 0; i < items.length; ++i)
    {
        const metadata = items[i];
        if (metadata.path === path)
        {
            index = i;
            break;
        }
    }
    return index;
}

// Page = number of rows mounted at a time. Even though the metadata is fully in-memory,
// rendering every row up front (plus every thumbnail's network request) doesn't scale
// when the ImageMap holds many thousands of images.
const PAGE_SIZE = 30;

// Debug-only total — exercised when imageListChooserDebugEnabledObservable is on,
// to verify pagination/scroll on a list large enough to span many pages.
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
        cachedDummyImageList.push({
            path: `1/${i + 1}`,
            title: `${pickRandom(randomTitleWords)} ${pickRandom(randomTitleWords)} (${i+1}) ${generatePlaceholderText(10)}`.trim(),
            author: `${pickRandom(randomFirstNames)} ${pickRandom(randomLastNames)} ${generatePlaceholderText(10)}`.trim(),
            coords: "0,0,0",
        });
    }
    return cachedDummyImageList;
}

export default ImageListChooserUtil;