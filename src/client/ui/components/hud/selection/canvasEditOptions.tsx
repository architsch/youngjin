import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import ObjectEditUtil from "../../../util/objectEditUtil";
import VoxelQuadSelection from "../../../../graphics/types/gizmo/voxelQuadSelection";
import { DISABLE_AUTO_SELECTION_ON_OBJECT_INSTALLATION,
    SUB_PANELS_BENEATH_SELECTION_TOOLS } from "../../../../system/clientConstants";
import PictureIcon from "../../../svg/icons/pictureIcon";
import PictureFrameIcon from "../../../svg/icons/pictureFrameIcon";
import CompositionThumbnailPanel from "../../panel/compositionThumbnailPanel";
import ImageMapThumbnailPanel from "../../panel/imageMapThumbnailPanel";
import CanvasObjectTypeConfig, { CANVAS_IMAGE_SUBFOLDER } from "../../../../../shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import SelectionToolRow from "./selectionToolRow";
import EditOptionsProps from "../../../types/editOptionsProps";
import RotateClockwiseIcon from "../../../svg/icons/rotateClockwiseIcon";

// Canvas tools: remove, painting, frame (one of its looks, the first frameless), and a clockwise quarter-turn. The
// painting and frame lists (they belong to the canvas) show one at a time: beneath this row, their buttons its
// toggles, or in its place until closed (see SUB_PANELS_BENEATH_SELECTION_TOOLS).
export default function CanvasEditOptions(props: EditOptionsProps)
{
    const imagePathMetadata = props.selection.gameObject.params.metadata[ObjectMetadataKeyEnumMap.ImagePath];
    const imagePath = imagePathMetadata ? imagePathMetadata.str : "";

    // Recomputed each render; zone changes re-announce the selection (see ClientVoxelManager). Where the canvas can't
    // be edited, a list beneath this row stays up with nothing in it to pick, and one in its place isn't raised.
    const canEdit = ObjectEditUtil.canEditObject(props.selection);
    const canRaisePanel = SUB_PANELS_BENEATH_SELECTION_TOOLS || canEdit;
    const choosingImage = canRaisePanel && props.openPanel == "imageMapThumbnail";
    const customizingFrame = canRaisePanel && props.openPanel == "compositionThumbnail";
    const toolsShown = SUB_PANELS_BENEATH_SELECTION_TOOLS || !(choosingImage || customizingFrame);
    const closePanel = SUB_PANELS_BENEATH_SELECTION_TOOLS ? undefined : () => props.setOpenPanel(null);

    // Full width, so the rows can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
        {toolsShown && <SelectionToolRow>
            <IconButton icon={<TrashIcon/>} size="md" color="red" shortcutKey="Delete"
                disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
                onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection, "Want to remove this?")}
            />
            <IconButton id="changeCanvasImageButton" icon={<PictureIcon/>} size="md"
                disabled={!canRaisePanel} highlight={choosingImage}
                onClick={() => props.setOpenPanel("imageMapThumbnail")}
            />
            <IconButton id="changeCanvasFrameButton" icon={<PictureFrameIcon/>} size="md"
                disabled={!canRaisePanel} highlight={customizingFrame}
                onClick={() => props.setOpenPanel("compositionThumbnail")}
            />
            <IconButton id="rotateCanvasButton" icon={<RotateClockwiseIcon/>} size="md"
                disabled={!canEdit || !ObjectEditUtil.canQuarterTurn(props.selection)}
                onClick={() => ObjectEditUtil.tryQuarterTurn(props.selection)}
            />
        </SelectionToolRow>}
        {choosingImage && <ImageMapThumbnailPanel
            id="canvasImageOptions"
            searchInputId="canvasImageSearchInput"
            searchPlaceholder="Search by title or author"
            mapName="PictureImageMap"
            subfolder={CANVAS_IMAGE_SUBFOLDER}
            currentPath={imagePath}
            resumed={props.resumed}
            canChoose={path => ObjectEditUtil.canSetObjectMetadata(props.selection, ObjectMetadataKeyEnumMap.ImagePath, path)}
            onChoose={path => ObjectEditUtil.trySetObjectMetadata(props.selection, ObjectMetadataKeyEnumMap.ImagePath, path)}
            onClose={closePanel}
        />}
        {customizingFrame && <CompositionThumbnailPanel
            id="customizeCanvasOptions"
            objectType={CanvasObjectTypeConfig.objectType}
            currentCompositionIndex={props.installing ? undefined : ObjectEditUtil.getCompositionIndex(props.selection)}
            canChoose={() => canEdit}
            onChoose={(compositionIndex) => {
                ObjectEditUtil.trySetCompositionIndex(props.selection, compositionIndex);
                // The pick that completes a canvas just added: the selection leaves it for a face near it (see
                // VoxelQuadPlacementOptions).
                if (props.installing)
                {
                    props.setOpenPanel(null);
                    if (!DISABLE_AUTO_SELECTION_ON_OBJECT_INSTALLATION)
                        VoxelQuadSelection.trySelectBestQuadNearby(props.selection.gameObject.params.transform.pos);
                }
            }}
            onClose={closePanel}
        />}
    </div>;
}
