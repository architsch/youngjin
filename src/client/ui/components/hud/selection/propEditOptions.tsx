import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import ObjectEditUtil from "../../../util/objectEditUtil";
import ShoppingCartIcon from "../../../svg/icons/shoppingCartIcon";
import ImageMapThumbnailPanel from "../../panel/imageMapThumbnailPanel";
import PropObjectTypeConfig, { PROP_IMAGE_SUBFOLDER } from "../../../../../shared/object/types/objectTypeConfig/propObjectTypeConfig";
import SelectionToolRow from "./selectionToolRow";
import EditOptionsProps from "../../../types/editOptionsProps";
import RotateClockwiseIcon from "../../../svg/icons/rotateClockwiseIcon";
import QuarterTurnsUtil from "../../../../../shared/object/util/quarterTurnsUtil";
import ObjectAttachmentUtil from "../../../../../shared/object/util/objectAttachmentUtil";
import ObjectScaleUtil from "../../../../../shared/object/util/objectScaleUtil";
import ObjectTransform from "../../../../../shared/object/types/objectTransform";

// Prop tools: remove, image, and a clockwise quarter-turn. The image button is a toggle, showing its list beneath
// this row.
export default function PropEditOptions(props: EditOptionsProps)
{
    const imagePathMetadata = props.selection.gameObject.params.metadata[ObjectMetadataKeyEnumMap.ImagePath];
    const imagePath = imagePathMetadata ? imagePathMetadata.str : "";

    // Recomputed each render; zone changes re-announce the selection (see ClientVoxelManager).
    const canEdit = ObjectEditUtil.canEditObject(props.selection);

    // Full width, so the rows can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
        <SelectionToolRow>
            <IconButton icon={<TrashIcon/>} size="md" color="red" shortcutKey="Delete"
                disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
                onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection, "Want to remove this?")}
            />
            <IconButton id="changePropImageButton" icon={<ShoppingCartIcon/>} size="md"
                highlight={props.openPanel == "imageMapThumbnail"}
                onClick={() => props.setOpenPanel("imageMapThumbnail")}
            />
            <IconButton id="rotatePropButton" icon={<RotateClockwiseIcon/>} size="md"
                disabled={!canEdit || !ObjectEditUtil.canQuarterTurn(props.selection)}
                onClick={() => ObjectEditUtil.tryQuarterTurn(props.selection)}
            />
        </SelectionToolRow>
        {props.openPanel == "imageMapThumbnail" && <ImageMapThumbnailPanel
            id="propImageOptions"
            searchInputId="propImageSearchInput"
            searchPlaceholder="Search"
            mapName="PictureImageMap"
            subfolder={PROP_IMAGE_SUBFOLDER}
            currentPath={imagePath}
            resumed={props.installing}
            canChoose={path => findResizedForImage(props.selection, path) != null}
            onChoose={path => trySetImage(props.selection, path)}
        />}
    </div>;
}

// An image comes with the prop resized to it where it stands, as one edit, so an image is offered only where the
// prop fits at its size.
function trySetImage(selection: ObjectSelection, path: string): void
{
    const resized = findResizedForImage(selection, path);
    if (resized != null)
        ObjectEditUtil.trySetObjectMetadata(selection, ObjectMetadataKeyEnumMap.ImagePath, path, resized.transform);
}

// The transform to send with the image, checked as the server will check it: none when the image leaves the prop's
// size alone, or else the first way the prop grows or shrinks to the size the image pins it to that fits where it
// stands (see ObjectAttachmentUtil.getResizeCandidates). Null when neither can be set.
function findResizedForImage(selection: ObjectSelection, path: string): {transform: ObjectTransform | undefined} | null
{
    const params = selection.gameObject.params;
    const scale = PropObjectTypeConfig.util.getImageScale(path, QuarterTurnsUtil.getQuarterTurns(params));
    const current = ObjectScaleUtil.sanitize(params.objectTypeIndex, params.transform.scale);
    const candidates = (scale == undefined || (scale.x == current.x && scale.y == current.y)) ? [undefined]
        : ObjectAttachmentUtil.getResizeCandidates(params.objectTypeIndex, params.transform, scale);
    for (const transform of candidates)
    {
        if (ObjectEditUtil.canSetObjectMetadata(selection, ObjectMetadataKeyEnumMap.ImagePath, path, transform))
            return {transform};
    }
    return null;
}
