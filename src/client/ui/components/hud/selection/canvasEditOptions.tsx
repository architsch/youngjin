import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import ImageChooser from "../../input/imageChooser";
import App from "../../../../app";
import RestrictedZoneUtil from "../../../../../shared/voxel/util/restrictedZoneUtil";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import ObjectEditUtil from "../../../util/objectEditUtil";
import PictureIcon from "../../../svg/icons/pictureIcon";
import PictureFrameIcon from "../../../svg/icons/pictureFrameIcon";
import CompositionThumbnailPanel from "../../panel/compositionThumbnailPanel";
import CanvasObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import SelectionToolRow from "./selectionToolRow";
import EditOptionsProps from "../../../types/editOptionsProps";

// Canvas tools: remove, image, and frame (one of its looks, the first frameless). The frame list stacks above
// this row (it belongs to the canvas).
export default function CanvasEditOptions(props: EditOptionsProps)
{
    const imagePathMetadata = props.selection.gameObject.params.metadata[ObjectMetadataKeyEnumMap.ImagePath];
    const initialImagePath = imagePathMetadata ? imagePathMetadata.str : "";

    const customizingFrame = props.openPanel == "compositionThumbnail";

    // Recomputed each render; zone changes re-announce the selection (see ClientVoxelManager).
    const canEdit = canEditCanvas(props.selection);

    // Full width, so the rows can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
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
            <ImageChooser
                title="Change Image"
                id="changeCanvasImageButton"
                icon={<PictureIcon/>}
                viewType="list"
                mapName="CanvasImageMap"
                initialChoicePath={initialImagePath}
                disabled={!canEdit}
                onChoose={path => {
                    ObjectEditUtil.trySetObjectMetadata(props.selection, ObjectMetadataKeyEnumMap.ImagePath, path);
                }}
            />
            <IconButton id="changeCanvasFrameButton" icon={<PictureFrameIcon/>} size="md"
                disabled={!canEdit}
                highlight={customizingFrame && canEdit}
                onClick={() => props.setOpenPanel(customizingFrame ? null : "compositionThumbnail")}
            />
        </SelectionToolRow>
    </div>;
}

// The room must be editable and the canvas outside others' restricted zones (see
// @docs/gameplay/restricted_zone.md). Choosers are disabled as a whole.
function canEditCanvas(selection: ObjectSelection): boolean
{
    const room = App.getCurrentRoom();
    if (!room)
        return false;
    const user = App.getUser();
    const params = selection.gameObject.params;

    return !RestrictedZoneUtil.blocksObjectEdit(user, room, params.objectTypeIndex, params.transform);
}
