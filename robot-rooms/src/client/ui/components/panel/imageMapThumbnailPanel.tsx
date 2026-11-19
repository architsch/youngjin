import { useEffect, useId, useMemo, useState } from "react";
import App from "../../../app";
import ImageMap from "../../../../shared/graphics/image/types/imageMap";
import ImageMapUtil from "../../../../shared/graphics/image/util/imageMapUtil";
import ImageChoiceUtil from "../../util/imageChoiceUtil";
import { IMAGE_CATEGORY_TABS_ENABLED } from "../../../system/clientConstants";
import { imageMapSettingsChangedObservable } from "../../../system/clientObservables";
import TabBar from "../basic/tabBar";
import TextInput from "../input/textInput";
import ThumbnailPanel from "./thumbnailPanel";

// Picks an image of one of an image map's subfolders from its thumbnails (see ThumbnailPanel), in the order the map
// lists them in (see ImageChoiceUtil). A category tab and the search bar, over the row, narrow it together; the
// panel opens on the current image's own category, or with none (or when resumed) on the tab the last panel of its
// id was left on, one resumed with that panel's search too. Off the live server it offers staging images too, and
// tags every image with its number, red for a staging one and black for an enabled one.
export default function ImageMapThumbnailPanel({ id, searchInputId, searchPlaceholder, mapName, subfolder,
    currentPath, resumed = false, canChoose, onChoose, onClose }: Props)
{
    const imageMap = ImageMapUtil.getImageMap(mapName);
    const assetsURL = App.getEnv().assets_url;
    const offLiveServer = !App.isPublicSite();
    const [categoryTab, setCategoryTab] = useState<string>(() => (currentPath !== undefined && !resumed)
        ? ImageChoiceUtil.getFirstCategoryTab(imageMap, subfolder, currentPath)
        : tabsLeft.get(id) ?? ImageMap.ALL_TAB);
    const [searchInput, setSearchInput] = useState<string>(() => resumed ? searchesLeft.get(id) ?? "" : "");

    // Each one is a change an admin made to the map's order or categories while the panel is open (see
    // AdminAssetSettingsEditor).
    const [numSettingsChanges, setNumSettingsChanges] = useState<number>(0);
    const listenerKey = `ui.imageMapThumbnailPanel.${useId()}`;
    useEffect(() => {
        imageMapSettingsChangedObservable.addListener(listenerKey, changedMapName => {
            if (changedMapName == mapName)
                setNumSettingsChanges(count => count + 1);
        });
        return () => imageMapSettingsChangedObservable.removeListener(listenerKey);
    }, [mapName]);

    // Memoized, as a new list of choices scrolls the row back to the current image (see ThumbnailPanel).
    const allItems = useMemo(() => ImageChoiceUtil.getItems(imageMap, subfolder, offLiveServer),
        [mapName, subfolder, numSettingsChanges]);
    const stagingPaths = useMemo(() => new Set(allItems.filter(item => item.staging).map(item => item.path)),
        [allItems]);
    const categoryTabs = useMemo(() => IMAGE_CATEGORY_TABS_ENABLED
        ? ImageChoiceUtil.getCategoryTabs(imageMap, subfolder, allItems) : [], [allItems]);
    // All when the tabs are off, or none of them is the one picked.
    const shownTab = categoryTabs.includes(categoryTab) ? categoryTab : ImageMap.ALL_TAB;
    const paths = useMemo(() => ImageChoiceUtil.getFilteredItems(
        ImageChoiceUtil.getItemsInTab(imageMap, subfolder, allItems, shownTab), searchInput).map(item => item.path),
        [allItems, shownTab, searchInput]);

    useEffect(() => {
        tabsLeft.set(id, shownTab);
        searchesLeft.set(id, searchInput);
    }, [shownTab, searchInput]);

    const categories = imageMap.getSubfolderCategories(subfolder);
    const getTabLabel = (tab: string) => (tab == ImageMap.ALL_TAB) ? "All" : (tab == ImageMap.MISC_TAB) ? "Misc"
        : categories.find(category => category.name == tab)?.title ?? tab;

    return <ThumbnailPanel
        id={id}
        choices={paths}
        current={currentPath}
        resumed={resumed}
        canChoose={canChoose}
        onChoose={onChoose}
        // Not draggable, so dragging across the row scrolls it.
        renderThumbnail={path => {
            const staging = stagingPaths.has(path);
            return <>
                <img src={imageMap.getThumbnailURLByPath(assetsURL, path)} alt="" draggable={false}
                    className="max-w-full max-h-full object-contain pointer-events-none select-none"/>
                {offLiveServer && <span
                    title={staging ? "Staging: not offered on the live server" : "Enabled: offered on the live server too"}
                    className={`absolute top-1 right-1 min-w-3 h-3 px-1 flex items-center justify-center rounded-full ring-1 ${staging ? "bg-red-500 ring-black/50" : "bg-black ring-white/50"} text-[9px] font-bold leading-none text-white select-none`}>
                    {path.substring(path.indexOf("/") + 1)}
                </span>}
            </>;
        }}
        thumbnailClassNames="relative size-18 flex items-center justify-center bg-gray-800"
        emptyText={(searchInput.trim().length > 0) ? "No images match your search." : "No images here."}
        // One row, as tall as its buttons. The tabs give way first on a narrow screen, scrolling instead.
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

// The category tab each panel was last left on, and the search it was left with, by id, for as long as the app runs
// (see ThumbnailPanel).
const tabsLeft = new Map<string, string>();
const searchesLeft = new Map<string, string>();

interface Props
{
    // Lets automation address the panel, each thumbnail by its position in the row (e.g. "canvasImageOptions.0"), and
    // each category tab by its name (e.g. "propImageOptionsCategories.food"). Panels choosing the same thing share one.
    id: string;
    searchInputId: string;
    // What the keywords hold, which differs by subfolder (a painting's are its title and author).
    searchPlaceholder: string;
    mapName: string;
    subfolder: string;
    // Absent when nothing is chosen yet (e.g. for an object about to be added).
    currentPath?: string;
    // Carries on from the last panel of its id (see ThumbnailPanel).
    resumed?: boolean;
    canChoose?: (path: string) => boolean;
    onChoose: (path: string) => void;
    // Absent means it has no close button (see ScrollPanel).
    onClose?: () => void;
}
