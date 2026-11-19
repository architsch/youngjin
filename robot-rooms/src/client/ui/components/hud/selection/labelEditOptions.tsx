import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import TextCursorIcon from "../../../svg/icons/textCursorIcon";
import PictureFrameIcon from "../../../svg/icons/pictureFrameIcon";
import ObjectEditUtil from "../../../util/objectEditUtil";
import CompositionThumbnailPanel from "../../panel/compositionThumbnailPanel";
import CustomizeLabelTextPanel from "../../panel/customizeLabelTextPanel";
import LabelObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/labelObjectTypeConfig";
import { SUB_PANELS_BENEATH_SELECTION_TOOLS } from "../../../../system/clientConstants";
import SelectionToolRow from "./selectionToolRow";
import EditOptionsProps from "../../../types/editOptionsProps";

// Superuser tools for a selected label: remove, text, and frame (one of its looks, the first frameless). The text
// bar and the frame list (they belong to the label) show one at a time: beneath this row, their buttons its toggles,
// or in its place until closed (see SUB_PANELS_BENEATH_SELECTION_TOOLS).
export default function LabelEditOptions(props: EditOptionsProps)
{
    const customizingText = props.openPanel == "labelText";
    const customizingFrame = props.openPanel == "compositionThumbnail";
    const toolsShown = SUB_PANELS_BENEATH_SELECTION_TOOLS || (!customizingText && !customizingFrame);
    const closePanel = SUB_PANELS_BENEATH_SELECTION_TOOLS ? undefined : () => props.setOpenPanel(null);

    // Full width, so the rows can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
        {toolsShown && <SelectionToolRow>
            <IconButton id="removeLabelButton" icon={<TrashIcon/>} size="md" color="red" shortcutKey="Delete"
                disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
                onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection, "Want to remove this label?")}
            />
            <IconButton id="changeLabelTextButton" icon={<TextCursorIcon/>} size="md"
                highlight={customizingText}
                onClick={() => props.setOpenPanel("labelText")}
            />
            <IconButton id="changeLabelFrameButton" icon={<PictureFrameIcon/>} size="md"
                highlight={customizingFrame}
                onClick={() => props.setOpenPanel("compositionThumbnail")}
            />
        </SelectionToolRow>}
        {customizingText && <CustomizeLabelTextPanel selection={props.selection} onClose={closePanel}/>}
        {customizingFrame && <CompositionThumbnailPanel
            id="customizeLabelOptions"
            objectType={LabelObjectTypeConfig.objectType}
            currentCompositionIndex={ObjectEditUtil.getCompositionIndex(props.selection)}
            onChoose={(compositionIndex) => ObjectEditUtil.trySetCompositionIndex(props.selection, compositionIndex)}
            onClose={closePanel}
        />}
    </div>;
}
