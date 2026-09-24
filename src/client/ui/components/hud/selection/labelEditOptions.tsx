import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import TextCursorIcon from "../../../svg/icons/textCursorIcon";
import PictureFrameIcon from "../../../svg/icons/pictureFrameIcon";
import ObjectEditUtil from "../../../util/objectEditUtil";
import CompositionThumbnailPanel from "../../panel/compositionThumbnailPanel";
import CustomizeLabelTextPanel from "../../panel/customizeLabelTextPanel";
import LabelObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/labelObjectTypeConfig";
import SelectionToolRow from "./selectionToolRow";
import EditOptionsProps from "../../../types/editOptionsProps";

const TEXT_PANEL = "text";
const FRAME_PANEL = "frame";

// Superuser tools for a selected label: remove, text, and frame (one of its looks, the first frameless). The
// text bar and the frame list stack above this row (they belong to the label), one at a time.
export default function LabelEditOptions(props: EditOptionsProps)
{
    const customizingText = props.openPanel == TEXT_PANEL;
    const customizingFrame = props.openPanel == FRAME_PANEL;

    // Full width, so the rows can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
        {customizingText && <CustomizeLabelTextPanel
            selection={props.selection}
            onClose={() => props.setOpenPanel(null)}
        />}
        {customizingFrame && <CompositionThumbnailPanel
            id="customizeLabelOptions"
            objectType={LabelObjectTypeConfig.objectType}
            currentCompositionIndex={ObjectEditUtil.getCompositionIndex(props.selection)}
            onChoose={(compositionIndex) => ObjectEditUtil.trySetCompositionIndex(props.selection, compositionIndex)}
            onClose={() => props.setOpenPanel(null)}
        />}
        <SelectionToolRow>
            <IconButton id="removeLabelButton" icon={<TrashIcon/>} size="md" color="red"
                disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
                onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection, "Want to remove this label?")}
            />
            <IconButton id="changeLabelTextButton" icon={<TextCursorIcon/>} size="md"
                highlight={customizingText}
                onClick={() => props.setOpenPanel(customizingText ? null : TEXT_PANEL)}
            />
            <IconButton id="changeLabelFrameButton" icon={<PictureFrameIcon/>} size="md"
                highlight={customizingFrame}
                onClick={() => props.setOpenPanel(customizingFrame ? null : FRAME_PANEL)}
            />
        </SelectionToolRow>
    </div>;
}
