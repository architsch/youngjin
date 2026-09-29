import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import ObjectEditUtil from "../../../util/objectEditUtil";
import PictureIcon from "../../../svg/icons/pictureIcon";
import PictureFrameIcon from "../../../svg/icons/pictureFrameIcon";
import CompositionThumbnailPanel from "../../panel/compositionThumbnailPanel";
import ImageMapThumbnailPanel from "../../panel/imageMapThumbnailPanel";
import CanvasObjectTypeConfig, { CANVAS_IMAGE_SUBFOLDER } from "../../../../../shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import SelectionToolRow from "./selectionToolRow";
import EditOptionsProps from "../../../types/editOptionsProps";
import RotateClockwiseIcon from "../../../svg/icons/rotateClockwiseIcon";

// Canvas tools: remove, painting, frame (one of its looks, the first frameless), and a clockwise quarter-turn. The
// painting and frame lists stack above this row (they belong to the canvas), one at a time.
export default function CanvasEditOptions(props: EditOptionsProps)
{
    const imagePathMetadata = props.selection.gameObject.params.metadata[ObjectMetadataKeyEnumMap.ImagePath];
    const imagePath = imagePathMetadata ? imagePathMetadata.str : "";

    const choosingImage = props.openPanel == "imageMapThumbnail";
    const customizingFrame = props.openPanel == "compositionThumbnail";

    // Recomputed each render; zone changes re-announce the selection (see ClientVoxelManager). Choosers are
    // disabled as a whole.
    const canEdit = ObjectEditUtil.canEditObject(props.selection);

    // Full width, so the rows can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
        {choosingImage && canEdit && <ImageMapThumbnailPanel
            id="canvasImageOptions"
            searchInputId="canvasImageSearchInput"
            searchPlaceholder="Search by title or author"
            mapName="PictureImageMap"
            subfolder={CANVAS_IMAGE_SUBFOLDER}
            currentPath={imagePath}
            canChoose={path => ObjectEditUtil.canSetObjectMetadata(props.selection, ObjectMetadataKeyEnumMap.ImagePath, path)}
            onChoose={path => ObjectEditUtil.trySetObjectMetadata(props.selection, ObjectMetadataKeyEnumMap.ImagePath, path)}
            onClose={() => props.setOpenPanel(null)}
        />}
        {customizingFrame && canEdit && <CompositionThumbnailPanel
            id="customizeCanvasOptions"
            objectType={CanvasObjectTypeConfig.objectType}
            currentCompositionIndex={ObjectEditUtil.getCompositionIndex(props.selection)}
            onChoose={(compositionIndex) => ObjectEditUtil.trySetCompositionIndex(props.selection, compositionIndex)}
            onClose={() => props.setOpenPanel(null)}
        />}
        <SelectionToolRow>
            <IconButton icon={<TrashIcon/>} size="md" color="red"
                disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
                onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection, "Want to remove this?")}
            />
            <IconButton id="changeCanvasImageButton" icon={<PictureIcon/>} size="md"
                disabled={!canEdit}
                highlight={choosingImage && canEdit}
                onClick={() => props.setOpenPanel(choosingImage ? null : "imageMapThumbnail")}
            />
            <IconButton id="changeCanvasFrameButton" icon={<PictureFrameIcon/>} size="md"
                disabled={!canEdit}
                highlight={customizingFrame && canEdit}
                onClick={() => props.setOpenPanel(customizingFrame ? null : "compositionThumbnail")}
            />
            <IconButton id="rotateCanvasButton" icon={<RotateClockwiseIcon/>} size="md"
                disabled={!canEdit || !ObjectEditUtil.canQuarterTurn(props.selection)}
                onClick={() => ObjectEditUtil.tryQuarterTurn(props.selection)}
            />
        </SelectionToolRow>
    </div>;
}
