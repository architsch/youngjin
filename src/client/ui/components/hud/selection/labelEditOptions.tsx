import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import TextCursorIcon from "../../../svg/icons/textCursorIcon";
import PaletteIcon from "../../../svg/icons/paletteIcon";
import PictureFrameIcon from "../../../svg/icons/pictureFrameIcon";
import ObjectEditUtil from "../../../util/objectEditUtil";
import ColorPaletteThumbnailPanel from "../../panel/colorPaletteThumbnailPanel";
import CompositionThumbnailPanel from "../../panel/compositionThumbnailPanel";
import CustomizeLabelTextPanel from "../../panel/customizeLabelTextPanel";
import LabelObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/labelObjectTypeConfig";
import LabelTextUtil from "../../../../../shared/object/util/labelTextUtil";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import { LABEL_COLOR_PALETTE_NAME } from "../../../../../shared/system/sharedConstants";
import SelectionToolRow from "./selectionToolRow";
import EditOptionsProps from "../../../types/editOptionsProps";

// Superuser tools for a selected label: remove, text, text color, and frame (one of its looks, the first
// frameless). The last three are toggles, each showing its panel beneath this row, one at a time.
export default function LabelEditOptions(props: EditOptionsProps)
{
    // Full width, so the rows can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
        <SelectionToolRow>
            <IconButton id="removeLabelButton" icon={<TrashIcon/>} size="md" color="red" shortcutKey="Delete"
                disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
                onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection, "Want to remove this label?")}
            />
            <IconButton id="changeLabelTextButton" icon={<TextCursorIcon/>} size="md"
                highlight={props.openPanel == "labelText"}
                onClick={() => props.setOpenPanel("labelText")}
            />
            <IconButton id="changeLabelColorButton" icon={<PaletteIcon/>} size="md"
                highlight={props.openPanel == "colorPaletteThumbnail"}
                onClick={() => props.setOpenPanel("colorPaletteThumbnail")}
            />
            <IconButton id="changeLabelFrameButton" icon={<PictureFrameIcon/>} size="md"
                highlight={props.openPanel == "compositionThumbnail"}
                onClick={() => props.setOpenPanel("compositionThumbnail")}
            />
        </SelectionToolRow>
        {props.openPanel == "labelText" && <CustomizeLabelTextPanel selection={props.selection}/>}
        {props.openPanel == "colorPaletteThumbnail" && <ColorPaletteThumbnailPanel
            id="labelColorOptions"
            paletteName={LABEL_COLOR_PALETTE_NAME}
            currentColorIndex={LabelTextUtil.getColorIndex(props.selection.gameObject.params)}
            onChoose={(colorIndex) => ObjectEditUtil.trySetObjectMetadata(props.selection,
                ObjectMetadataKeyEnumMap.LabelColor, `${colorIndex}`)}
        />}
        {props.openPanel == "compositionThumbnail" && <CompositionThumbnailPanel
            id="customizeLabelOptions"
            objectType={LabelObjectTypeConfig.objectType}
            currentCompositionIndex={ObjectEditUtil.getCompositionIndex(props.selection)}
            onChoose={(compositionIndex) => ObjectEditUtil.trySetCompositionIndex(props.selection, compositionIndex)}
        />}
    </div>;
}
