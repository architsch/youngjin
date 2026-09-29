import { useMemo, useState } from "react";
import App from "../../../app";
import ImageMap from "../../../../shared/graphics/image/types/imageMap";
import ImageMapUtil from "../../../../shared/graphics/image/util/imageMapUtil";
import ImageChoiceUtil from "../../util/imageChoiceUtil";
import { IMAGE_CATEGORY_TABS_ENABLED } from "../../../system/clientConstants";
import TabBar from "../basic/tabBar";
import TextInput from "../input/textInput";
import ThumbnailPanel from "./thumbnailPanel";

// Picks an image of one of an image map's subfolders from its thumbnails (see ThumbnailPanel), alike images together
// (see ImageChoiceUtil). A category tab and the search bar, beside the close button, narrow the row together; the
// panel opens on the current image's own category.
export default function ImageMapThumbnailPanel({ id, searchInputId, searchPlaceholder, mapName, subfolder,
    currentPath, canChoose, onChoose, onClose }: Props)
{
    const imageMap = ImageMapUtil.getImageMap(mapName);
    const assetsURL = App.getEnv().assets_url;
    const [categoryTab, setCategoryTab] = useState<string>(() =>
        ImageChoiceUtil.getFirstCategoryTab(imageMap, subfolder, currentPath));
    const [searchInput, setSearchInput] = useState<string>("");

    // Memoized, as a new list of choices scrolls the row back to the current image (see ThumbnailPanel).
    const allItems = useMemo(() => ImageChoiceUtil.getItems(imageMap, subfolder), [mapName, subfolder]);
    const categoryTabs = useMemo(() => IMAGE_CATEGORY_TABS_ENABLED
        ? ImageChoiceUtil.getCategoryTabs(imageMap, subfolder, allItems) : [], [allItems]);
    // All when the tabs are off, or none of them is the one picked.
    const shownTab = categoryTabs.includes(categoryTab) ? categoryTab : ImageMap.ALL_TAB;
    const paths = useMemo(() => ImageChoiceUtil.getFilteredItems(
        ImageChoiceUtil.getItemsInTab(imageMap, subfolder, allItems, shownTab), searchInput)
        .map(metadata => metadata.path), [allItems, shownTab, searchInput]);

    const categories = imageMap.getSubfolderCategories(subfolder);
    const getTabLabel = (tab: string) => (tab == ImageMap.ALL_TAB) ? "All" : (tab == ImageMap.MISC_TAB) ? "Misc"
        : categories.find(category => category.name == tab)?.title ?? tab;

    return <ThumbnailPanel
        id={id}
        choices={paths}
        current={currentPath}
        canChoose={canChoose}
        onChoose={onChoose}
        // Not draggable, so dragging across the row scrolls it.
        renderThumbnail={path => <img src={imageMap.getThumbnailURLByPath(assetsURL, path)} alt="" draggable={false}
            className="max-w-full max-h-full object-contain pointer-events-none select-none"/>}
        thumbnailClassNames="size-20 flex items-center justify-center bg-gray-800"
        emptyText="No images match your search."
        // As tall as the close button. The tabs give way first on a narrow screen, scrolling instead.
        closeRowContent={<>
            <TextInput id={searchInputId} size="sm" placeholder={searchPlaceholder} currValue={searchInput}
                setTextInput={setSearchInput} additionalClassNames="flex-1 min-w-32 max-w-xs h-7.5"/>
            {categoryTabs.length > 0 && <TabBar id={`${id}Categories`} size="sm" tabNames={categoryTabs}
                selectedTabName={shownTab} onSelect={setCategoryTab} getTabLabel={getTabLabel}
                additionalClassNames="min-w-0 pointer-events-auto"/>}
        </>}
        onClose={onClose}
    />;
}

interface Props
{
    // Lets automation address the panel, each thumbnail by its position in the row (e.g. "canvasImageOptions.0"), and
    // each category tab by its name (e.g. "propImageOptionsCategories.food").
    id: string;
    searchInputId: string;
    // What the keywords hold, which differs by subfolder (a painting's are its title and author).
    searchPlaceholder: string;
    mapName: string;
    subfolder: string;
    currentPath: string;
    canChoose: (path: string) => boolean;
    onChoose: (path: string) => void;
    onClose: () => void;
}
