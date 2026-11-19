import { useEffect, useMemo, useRef, useState } from "react";
import App from "../../../app";
import ImageMap from "../../../../shared/graphics/image/types/imageMap";
import ImageMapUtil from "../../../../shared/graphics/image/util/imageMapUtil";
import ImageMapSettingsUtil from "../../../../shared/graphics/image/util/imageMapSettingsUtil";
import AdminAssetSettings from "../../../../shared/system/types/adminAssetSettings";
import { ADMIN_ASSET_SETTINGS_FILE_NAME } from "../../../../shared/system/sharedConstants";
import { imageMapSettingsChangedObservable, notificationMessageObservable } from "../../../system/clientObservables";
import LocalFileUtil from "../../../system/util/localFileUtil";
import ImageChoiceUtil from "../../util/imageChoiceUtil";
import PopupUtil from "../../util/popupUtil";
import Icon from "../basic/icon";
import Text from "../basic/text";
import Button from "../input/button";
import IconButton from "../input/iconButton";
import PaneDivider from "../input/paneDivider";
import RangeInput from "../input/rangeInput";
import ImageCategoryChips from "../panel/imageCategoryChips";
import ImageCategoryTree from "../panel/imageCategoryTree";
import ImageOrderGrid from "../panel/imageOrderGrid";
import CloseIcon from "../../svg/icons/closeIcon";
import MagnifierMinusIcon from "../../svg/icons/magnifierMinusIcon";
import MagnifierPlusIcon from "../../svg/icons/magnifierPlusIcon";

// The window an admin sets the admin asset settings in (see AdminAssetSettings), which the "aas" debug command opens
// (see DebugStats). On the left, the picture map's subfolders and their categories as a tree, where categories are
// added, renamed, deleted and dragged into order (see ImageCategoryTree); on the right, every image of the subfolder
// selected there, in the order the map lists them in, to be dragged into place or onto a category of the tree, which
// files it under that one too, with those of a category selected there marked and a slider under them for their size
// (see ImageOrderGrid); and under the tree, the categories of the image selected in that grid, to be changed (see
// ImageCategoryChips). Each edit changes the map on this client alone, at once and until the page is left. Save
// writes them all out as the settings file, to be put in that file's place and built into the game, and Load takes a
// saved file back, to go on from.
export default function AdminAssetSettingsEditor()
{
    const imageMap = ImageMapUtil.getImageMap(ADMIN_SET_IMAGE_MAP_NAME);
    // The first time, the subfolder the game's choosers list first.
    const [selection, setSelection] = useState<{subfolder: string, category?: string}>(() => selectionLeft
        ?? {subfolder: imageMap.getSubfolderNames()[0]});
    // The image whose categories are shown, one of the subfolder selected.
    const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined);
    // Each one changes how the map's images are offered: their order, their categories, or the categories there are.
    const [numEdits, setNumEdits] = useState<number>(0);
    const [paneSizes, setPaneSizes] = useState(paneSizesLeft);
    const [tileSize, setTileSize] = useState<number>(tileSizeLeft);
    // As they were when a divider was taken hold of.
    const heldPaneSizesRef = useRef(paneSizes);
    const bodyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        selectionLeft = selection;
        paneSizesLeft = paneSizes;
        tileSizeLeft = tileSize;
    }, [selection, paneSizes, tileSize]);

    const images = useMemo(() => ImageChoiceUtil.getOrdered(imageMap, selection.subfolder),
        [selection.subfolder, numEdits]);
    const categories = imageMap.getSubfolderCategories(selection.subfolder);

    // Told to every chooser of the map open at the time, too.
    const noteEdit = () => {
        setNumEdits(count => count + 1);
        imageMapSettingsChangedObservable.set(ADMIN_SET_IMAGE_MAP_NAME);
    };
    const load = async () => {
        if (!await loadSettings(imageMap))
            return;
        // A category the file doesn't list is no longer there to be selected.
        setSelection(({subfolder, category}) => imageMap.getSubfolderCategories(subfolder)
            .some(listed => listed.name == category) ? {subfolder, category} : {subfolder});
        noteEdit();
    };
    // The left pane grows as its divider goes right, and the bottom one as its own goes up.
    const resize = (pane: "left" | "bottom", distance: number) => {
        const room = (pane == "left") ? bodyRef.current?.clientWidth : bodyRef.current?.clientHeight;
        const size = heldPaneSizesRef.current[pane] + ((pane == "left") ? distance : -distance);
        setPaneSizes(sizes => ({...sizes,
            [pane]: Math.max(MIN_PANE_SIZE_PX, Math.min(MAX_PANE_SHARE * (room ?? Infinity), size))}));
    };

    return <div id="adminAssetSettingsEditor" className="flex flex-col gap-1.5 p-1 w-[92vw] h-[88vh]">
        <div className="flex flex-row items-center gap-1.5 shrink-0">
            <Button id="adminAssetSettingsSave" name="Save" size="sm" onClick={() => void saveSettings(imageMap)}/>
            <Button id="adminAssetSettingsLoad" name="Load" size="sm" onClick={() => void load()}/>
            <Text content="Admin Asset Settings" size="sm" additionalClassNames="min-w-0 truncate"/>
            <IconButton id="adminAssetSettingsClose" icon={<CloseIcon/>} size="sm" onClick={PopupUtil.closePopup}
                additionalClassNames="ml-auto"/>
        </div>
        <div ref={bodyRef} className="flex flex-row flex-1 min-h-0">
            <div className="flex flex-col shrink-0" style={{width: paneSizes.left, maxWidth: MAX_PANE_SIZE}}>
                <ImageCategoryTree id="imageCategoryTree" imageMap={imageMap} subfolder={selection.subfolder}
                    category={selection.category}
                    onSelect={(subfolder, category) => {
                        if (subfolder != selection.subfolder)
                            setSelectedPath(undefined);
                        setSelection({subfolder, category});
                    }}
                    onEdit={noteEdit} additionalClassNames="flex-1 min-h-0"/>
                <PaneDivider id="adminAssetSettingsBottomDivider" axis="y"
                    onDragStart={() => heldPaneSizesRef.current = paneSizes}
                    onDrag={distance => resize("bottom", distance)}/>
                {/* Empty until an image is selected. */}
                <div className="flex flex-col gap-1.5 shrink-0 p-1.5 overflow-y-auto bg-gray-700 rounded-lg yj-surface-convex yj-visible-scrollbar"
                    style={{height: paneSizes.bottom, maxHeight: MAX_PANE_SIZE}}>
                    {selectedPath != undefined && <>
                        <div className="flex flex-row items-center gap-1.5 shrink-0">
                            <img src={imageMap.getThumbnailURLByPath(App.getEnv().assets_url, selectedPath)} alt=""
                                draggable={false} className="size-7.5 object-contain rounded-sm bg-gray-800 select-none"/>
                            <Text content={selectedPath} size="xs"/>
                        </div>
                        <ImageCategoryChips key={selectedPath} id="imageCategoryChips" categories={categories}
                            filedUnder={ImageChoiceUtil.getCategories(imageMap, selectedPath)}
                            onChange={filedUnder => {
                                ImageChoiceUtil.setCategories(imageMap, selectedPath, filedUnder);
                                noteEdit();
                            }}/>
                    </>}
                </div>
            </div>
            <PaneDivider id="adminAssetSettingsLeftDivider" axis="x"
                onDragStart={() => heldPaneSizesRef.current = paneSizes}
                onDrag={distance => resize("left", distance)}/>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
                <ImageOrderGrid id="imageOrderGrid" imageMap={imageMap} images={images} selectedPath={selectedPath}
                    markedCategory={selection.category} tileSize={tileSize} onSelect={setSelectedPath}
                    onMove={(path, position) => {
                        ImageChoiceUtil.moveItem(imageMap, path, position);
                        noteEdit();
                    }}
                    // The tree's drop targets are the categories of the subfolder shown, by their names.
                    onDropOut={(path, category) => {
                        const filedUnder = ImageChoiceUtil.getCategories(imageMap, path);
                        if (filedUnder.includes(category))
                            return;
                        ImageChoiceUtil.setCategories(imageMap, path, [...filedUnder, category]);
                        noteEdit();
                    }}
                    additionalClassNames="flex-1 min-h-0"/>
                <div id="adminAssetSettingsTileSize" className="flex flex-row items-center justify-end gap-1 shrink-0 text-gray-300">
                    <Icon icon={<MagnifierMinusIcon/>} size="sm"/>
                    <RangeInput currValue={`${tileSize}`} setValue={value => setTileSize(Number(value))}
                        min={`${MIN_TILE_SIZE_PX}`} max={`${MAX_TILE_SIZE_PX}`} step={`${TILE_SIZE_STEP_PX}`}
                        showValueInput={false} additionalClassNames="w-32"/>
                    <Icon icon={<MagnifierPlusIcon/>} size="sm"/>
                </div>
            </div>
        </div>
    </div>;
}

// The image map whose settings an admin sets in the game.
const ADMIN_SET_IMAGE_MAP_NAME = "PictureImageMap";

// The least a pane may be resized to (in CSS px), and the most, as a share of the window's body.
const MIN_PANE_SIZE_PX = 96;
const MAX_PANE_SHARE = 0.7;
const MAX_PANE_SIZE = `${100 * MAX_PANE_SHARE}%`;

// The sizes the grid's thumbnails can be given (in CSS px).
const MIN_TILE_SIZE_PX = 32;
const MAX_TILE_SIZE_PX = 160;
const TILE_SIZE_STEP_PX = 4;

// What the tree was left on, and how the panes and the thumbnails were left sized, for as long as the app runs. The
// thumbnails start as large as the texture strip's cells are on a wide screen (see VoxelQuadTextureOptions).
let selectionLeft: {subfolder: string, category?: string} | undefined;
let paneSizesLeft = {left: 272, bottom: 168};
let tileSizeLeft = 44;

// Saves the map's order and categories as they stand now, as the settings file.
async function saveSettings(imageMap: ImageMap): Promise<void>
{
    const settings: AdminAssetSettings = {
        [ImageMapSettingsUtil.getMapKey(ADMIN_SET_IMAGE_MAP_NAME)]: ImageChoiceUtil.getSettings(imageMap)};
    const bytes = new TextEncoder().encode(ImageMapSettingsUtil.serializeFile(settings));
    try
    {
        if (await LocalFileUtil.save(bytes.buffer, ADMIN_ASSET_SETTINGS_FILE_NAME, ".json", "Admin asset settings"))
            notificationMessageObservable.set("Admin asset settings saved!");
    }
    catch (err)
    {
        console.error("Failed to save the admin asset settings to a file.", err);
        notificationMessageObservable.set("Failed to save the admin asset settings.");
    }
}

// Takes a settings file saved earlier and offers the map by it, whatever was set before. True if it did: a file
// that can't be used (see ImageMapSettingsUtil.parseFile) changes nothing.
async function loadSettings(imageMap: ImageMap): Promise<boolean>
{
    const file = await LocalFileUtil.pick(".json");
    if (!file)
        return false;
    const mapKey = ImageMapSettingsUtil.getMapKey(ADMIN_SET_IMAGE_MAP_NAME);
    try
    {
        const {settings, problem} = ImageMapSettingsUtil.parseFile(await file.text(), mapKey);
        if (settings == undefined)
        {
            // A category's problem ends the sentence itself.
            const refusal = `${file.name} ${problem ?? `holds nothing under "${mapKey}"`}`;
            notificationMessageObservable.set(refusal.endsWith(".") ? refusal : `${refusal}.`);
            return false;
        }
        ImageChoiceUtil.applySettings(imageMap, settings);
        notificationMessageObservable.set("Admin asset settings loaded!");
        return true;
    }
    catch (err)
    {
        console.error("Failed to load the admin asset settings from a file.", err);
        notificationMessageObservable.set("Failed to load the admin asset settings.");
        return false;
    }
}
