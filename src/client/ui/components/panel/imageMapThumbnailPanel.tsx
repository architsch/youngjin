import { useEffect, useId, useMemo, useRef, useState } from "react";
import App from "../../../app";
import ImageMap from "../../../../shared/graphics/image/types/imageMap";
import ImageMapUtil from "../../../../shared/graphics/image/util/imageMapUtil";
import ImageMapSettingsUtil from "../../../../shared/graphics/image/util/imageMapSettingsUtil";
import ImageChoiceUtil from "../../util/imageChoiceUtil";
import PopupUtil from "../../util/popupUtil";
import { IMAGE_CATEGORY_EDIT_ENABLED, IMAGE_CATEGORY_TAB_EDIT_ENABLED, IMAGE_CATEGORY_TABS_ENABLED,
    IMAGE_THUMBNAIL_REORDER_ENABLED } from "../../../system/clientConstants";
import { imageMapSettingsAppliedObservable, notificationMessageObservable } from "../../../system/clientObservables";
import { dummyImagesDebugEnabledObservable } from "../../../../shared/system/sharedObservables";
import RoomValidationUtil from "../../../../shared/room/util/roomValidationUtil";
import TabBar from "../basic/tabBar";
import IconButton from "../input/iconButton";
import TextInput from "../input/textInput";
import CloseIcon from "../../svg/icons/closeIcon";
import EditIcon from "../../svg/icons/editIcon";
import MinusIcon from "../../svg/icons/minusIcon";
import PlusIcon from "../../svg/icons/plusIcon";
import ImageCategoryBar from "./imageCategoryBar";
import ImageCategoryNameBar from "./imageCategoryNameBar";
import ThumbnailPanel from "./thumbnailPanel";

// Picks an image of one of an image map's subfolders from its thumbnails (see ThumbnailPanel), in the order the map
// lists them in (see ImageChoiceUtil). A category tab and the search bar, over the row, narrow it together; the
// panel opens on the current image's own category, or with none (or when resumed) on the tab the last panel of its
// id was left on, one resumed with that panel's search too. Off the live server it offers staging images too, and
// tags every image with its number, red for a staging one and black for an enabled one. An admin can rearrange the
// row by hand, set the categories of an image picked up (see ImageCategoryBar), and add, delete and rename the
// categories themselves with the buttons beside their tabs, for every chooser of the map until the page is left
// (the "eaas" debug command saves it all to keep, and "iaas" takes a saved one back; see DebugStats).
export default function ImageMapThumbnailPanel({ id, searchInputId, searchPlaceholder, mapName, subfolder,
    currentPath, resumed = false, canChoose, onChoose }: Props)
{
    const imageMap = ImageMapUtil.getImageMap(mapName);
    const assetsURL = App.getEnv().assets_url;
    const offLiveServer = !App.isPublicSite();
    const [categoryTab, setCategoryTab] = useState<string>(() => (currentPath !== undefined && !resumed)
        ? ImageChoiceUtil.getFirstCategoryTab(imageMap, subfolder, currentPath)
        : tabsLeft.get(id) ?? ImageMap.ALL_TAB);
    const [searchInput, setSearchInput] = useState<string>(() => resumed ? searchesLeft.get(id) ?? "" : "");
    // Each one changes what the images are offered as: the order they come in, what one is filed under, or the
    // categories there are.
    const [numEdits, setNumEdits] = useState<number>(0);
    // The image whose categories are being set, and every one picked up since the row was last narrowed anew: those
    // stay in it whatever they are filed under since, so one taken out of the tab shown is seen to be, until then.
    const [filedPath, setFiledPath] = useState<string | undefined>(undefined);
    const [keptPaths, setKeptPaths] = useState<string[]>([]);
    // The image picked up and not yet let go, marked as the one being filed is.
    const [heldPath, setHeldPath] = useState<string | undefined>(undefined);
    // The category being named: one renamed, or with none, a new one.
    const [naming, setNaming] = useState<{renamed?: string} | null>(null);
    const narrowAnew = () => {
        setFiledPath(undefined);
        setKeptPaths([]);
        setNaming(null);
    };

    // The map's settings set whole while the panel is open: an edit like its own, narrowing the row anew.
    const listenerKey = `ui.imageMapThumbnailPanel.${useId()}`;
    useEffect(() => {
        imageMapSettingsAppliedObservable.addListener(listenerKey, appliedMapName => {
            if (appliedMapName != mapName)
                return;
            narrowAnew();
            setNumEdits(count => count + 1);
        });
        return () => imageMapSettingsAppliedObservable.removeListener(listenerKey);
    }, [mapName]);

    const categories = imageMap.getSubfolderCategories(subfolder);
    // The dummy images stand in for the map's, and have neither an order nor categories of their own.
    const canEdit = RoomValidationUtil.userIsAdmin(App.getUser()) && !dummyImagesDebugEnabledObservable.peek();
    const canRearrange = IMAGE_THUMBNAIL_REORDER_ENABLED && canEdit;
    const canFile = IMAGE_CATEGORY_EDIT_ENABLED && canEdit && categories.length > 0;
    const canEditTabs = IMAGE_CATEGORY_TAB_EDIT_ENABLED && IMAGE_CATEGORY_TABS_ENABLED && canEdit;

    const allItems = useMemo(() => ImageChoiceUtil.getItems(imageMap, subfolder, offLiveServer),
        [mapName, subfolder, numEdits]);
    const stagingPaths = useMemo(() => new Set(allItems.filter(item => item.staging).map(item => item.path)),
        [allItems]);
    // One who can edit the tabs sees those holding nothing too, or there would be no getting at them.
    const categoryTabs = useMemo(() => IMAGE_CATEGORY_TABS_ENABLED ? ImageChoiceUtil.getCategoryTabs(imageMap,
        subfolder, allItems, (keptPaths.length > 0) ? categoryTab : undefined, canEditTabs) : [],
        [allItems, keptPaths, categoryTab, canEditTabs]);
    // All when the tabs are off, or none of them is the one picked.
    const shownTab = categoryTabs.includes(categoryTab) ? categoryTab : ImageMap.ALL_TAB;
    const shownCategory = categories.find(category => category.name == shownTab);
    const narrowedPaths = useMemo(() => new Set(ImageChoiceUtil.getFilteredItems(
        ImageChoiceUtil.getItemsInTab(imageMap, subfolder, allItems, shownTab), searchInput).map(item => item.path)),
        [allItems, shownTab, searchInput]);
    // The same list for the same row, as a new list of choices scrolls the row back to the current image (see
    // ThumbnailPanel), which a change of categories must not.
    const pathsRef = useRef<string[]>([]);
    const paths = useMemo(() => {
        const row = ImageChoiceUtil.getRow(allItems, allItems.filter(item => narrowedPaths.has(item.path)), keptPaths)
            .map(item => item.path);
        if (row.length != pathsRef.current.length || row.some((path, position) => path != pathsRef.current[position]))
            pathsRef.current = row;
        return pathsRef.current;
    }, [allItems, narrowedPaths, keptPaths]);

    useEffect(() => {
        tabsLeft.set(id, shownTab);
        searchesLeft.set(id, searchInput);
    }, [shownTab, searchInput]);

    const getTabLabel = (tab: string) => (tab == ImageMap.ALL_TAB) ? "All" : (tab == ImageMap.MISC_TAB) ? "Misc"
        : categories.find(category => category.name == tab)?.title ?? tab;

    // One bar at a time over the panel: the one naming a category, or the one filing an image.
    const startNaming = (next: {renamed?: string} | null) => {
        setNaming(next);
        setFiledPath(undefined);
    };
    // Adds the category named, or gives the one being renamed that name, unless it can't be one.
    const nameCategory = (title: string) => {
        const category = ImageMapSettingsUtil.toCategory(title);
        const renamed = naming?.renamed;
        const problem = (renamed != undefined) ? ImageChoiceUtil.renameCategory(imageMap, subfolder, renamed, category)
            : ImageChoiceUtil.addCategory(imageMap, subfolder, category);
        if (problem != undefined)
        {
            notificationMessageObservable.set(problem);
            return;
        }
        if (renamed != undefined && categoryTab == renamed)
            setCategoryTab(category.name);
        setNaming(null);
        setNumEdits(count => count + 1);
    };
    const removeCategory = (name: string) => {
        ImageChoiceUtil.removeCategory(imageMap, subfolder, name);
        setCategoryTab(ImageMap.ALL_TAB);
        narrowAnew();
        setNumEdits(count => count + 1);
    };
    // Asked first when images would be taken out of it, which only filing each one again would undo.
    const confirmRemovingCategory = (name: string, title: string) => {
        const numFiled = imageMap.getImageMetadataListInSubfolder(subfolder)
            .filter(image => ImageMap.getCategories(image.keywords).includes(name)).length;
        if (numFiled == 0)
        {
            removeCategory(name);
            return;
        }
        PopupUtil.openPopup({
            popupType: "confirm",
            params: {
                message: `Delete the category "${title}"? ${numFiled} image${numFiled == 1 ? " is" : "s are"} filed under it.`,
                onConfirm: () => {
                    PopupUtil.closePopup();
                    removeCategory(name);
                },
                onCancel: PopupUtil.closePopup,
            },
        });
    };
    const adding = naming != null && naming.renamed == undefined;

    return <>
        {canEditTabs && naming != null && <ImageCategoryNameBar
            key={naming.renamed ?? ""}
            id={`${id}CategoryNameBar`}
            title={categories.find(category => category.name == naming.renamed)?.title ?? ""}
            confirmName={adding ? "Add" : "Rename"}
            onConfirm={nameCategory}
            onClose={() => setNaming(null)}
        />}
        {canFile && filedPath != undefined && paths.includes(filedPath) && <ImageCategoryBar
            key={filedPath}
            id={`${id}CategoryBar`}
            thumbnailURL={imageMap.getThumbnailURLByPath(assetsURL, filedPath)}
            categories={categories}
            filedUnder={ImageChoiceUtil.getCategories(imageMap, filedPath)}
            onChange={filedUnder => {
                ImageChoiceUtil.setCategories(imageMap, filedPath, filedUnder);
                setNumEdits(count => count + 1);
            }}
            onClose={() => setFiledPath(undefined)}
        />}
        <ThumbnailPanel
            id={id}
            choices={paths}
            current={currentPath}
            resumed={resumed}
            canChoose={canChoose}
            onChoose={onChoose}
            onReorder={canRearrange ? (path, position) => {
                ImageChoiceUtil.moveItem(imageMap, paths, path, position);
                setNumEdits(count => count + 1);
            } : undefined}
            onPickUp={(canRearrange || canFile) ? path => {
                setHeldPath(path);
                if (!canFile)
                    return;
                setFiledPath(path);
                setKeptPaths(kept => kept.includes(path) ? kept : [...kept, path]);
                setNaming(null);
            } : undefined}
            onLetGo={() => setHeldPath(undefined)}
            // One no longer under the tab shown has no place in its row to be put at.
            canMove={path => narrowedPaths.has(path)}
            // Not draggable, so dragging across the row scrolls it.
            renderThumbnail={path => {
                const staging = stagingPaths.has(path);
                const strayed = !narrowedPaths.has(path);
                return <>
                    <img src={imageMap.getThumbnailURLByPath(assetsURL, path)} alt="" draggable={false}
                        className={`max-w-full max-h-full object-contain pointer-events-none select-none ${strayed ? "opacity-30" : ""}`}/>
                    {strayed && <span title="No longer in this row: gone from it once it is narrowed anew"
                        className="absolute inset-0 p-3 text-pink-300">
                        <CloseIcon/>
                    </span>}
                    {(path == heldPath || path == filedPath) && <span className="absolute inset-0 rounded-md border-3 border-amber-400 pointer-events-none"/>}
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
                    setTextInput={input => {
                        setSearchInput(input);
                        narrowAnew();
                    }} additionalClassNames="flex-1 min-w-32 max-w-xs h-7.5"/>
                {categoryTabs.length > 0 && <TabBar id={`${id}Categories`} size="sm" tabNames={categoryTabs}
                    selectedTabName={shownTab} onSelect={tab => {
                        setCategoryTab(tab);
                        narrowAnew();
                    }} getTabLabel={getTabLabel}
                    additionalClassNames="min-w-0 pointer-events-auto"/>}
                {/* A new category, and the one whose tab is shown done away with or renamed. */}
                {canEditTabs && <>
                    <IconButton id={`${id}CategoryAdd`} icon={<PlusIcon/>} size="sm" highlight={adding}
                        onClick={() => startNaming(adding ? null : {})}/>
                    <IconButton id={`${id}CategoryRemove`} icon={<MinusIcon/>} size="sm" disabled={shownCategory == undefined}
                        onClick={() => confirmRemovingCategory(shownCategory!.name, shownCategory!.title)}/>
                    <IconButton id={`${id}CategoryRename`} icon={<EditIcon/>} size="sm" disabled={shownCategory == undefined}
                        highlight={naming?.renamed != undefined}
                        onClick={() => startNaming((naming?.renamed != undefined) ? null : {renamed: shownTab})}/>
                </>}
            </>}
        />
    </>;
}

// The category tab each panel was last left on, and the search it was left with, by id, for as long as the app runs
// (see ThumbnailPanel).
const tabsLeft = new Map<string, string>();
const searchesLeft = new Map<string, string>();

interface Props
{
    // Lets automation address the panel, each thumbnail by its position in the row (e.g. "canvasImageOptions.0"),
    // each category tab by its name (e.g. "propImageOptionsCategories.food"), and the buttons that add, delete and
    // rename a category (e.g. "propImageOptionsCategoryAdd"). Panels choosing the same thing share one.
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
}
