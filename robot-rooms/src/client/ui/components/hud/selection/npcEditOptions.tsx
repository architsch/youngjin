import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import PersonIcon from "../../../svg/icons/personIcon";
import GearIcon from "../../../svg/icons/gearIcon";
import RotateClockwiseIcon from "../../../svg/icons/rotateClockwiseIcon";
import ObjectEditUtil from "../../../util/objectEditUtil";
import CustomizePlayerPanel from "../../panel/customizePlayerPanel";
import CustomizeNpcBehaviorPanel from "../../panel/customizeNpcBehaviorPanel";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import { OBJECT_NAME_MAX_LENGTH } from "../../../../../shared/system/sharedConstants";
import { SUB_PANELS_BENEATH_SELECTION_TOOLS } from "../../../../system/clientConstants";
import ObjectMetadataTextInput from "./objectMetadataTextInput";
import SelectionToolRow from "./selectionToolRow";
import EditOptionsProps from "../../../types/editOptionsProps";

// Tools for a selected NPC, which is an admin's to lay: remove, its name, its looks, how it is played, and a clockwise
// quarter-turn of the way it faces. The looks and how it is played show one at a time: beneath this row, their buttons
// its toggles, or in its place until closed (see SUB_PANELS_BENEATH_SELECTION_TOOLS).
export default function NpcEditOptions(props: EditOptionsProps)
{
    const customizingLooks = props.openPanel == "playerParts";
    const customizingBehavior = props.openPanel == "npcBehavior";
    const toolsShown = SUB_PANELS_BENEATH_SELECTION_TOOLS || !(customizingLooks || customizingBehavior);
    const closePanel = SUB_PANELS_BENEATH_SELECTION_TOOLS ? undefined : () => props.setOpenPanel(null);

    // Full width, so the rows can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
        {toolsShown && <SelectionToolRow>
            <IconButton id="removeNpcButton" icon={<TrashIcon/>} size="md" color="red" shortcutKey="Delete"
                disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
                onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection, "Want to remove this character?")}
            />
            <ObjectMetadataTextInput id="npcNameInput" selection={props.selection}
                metadataKey={ObjectMetadataKeyEnumMap.Label} maxLength={OBJECT_NAME_MAX_LENGTH}
                placeholder="Name" additionalClassNames="w-36"/>
            <IconButton id="customizeNpcButton" icon={<PersonIcon/>} size="md"
                highlight={customizingLooks}
                onClick={() => props.setOpenPanel("playerParts")}
            />
            <IconButton id="customizeNpcBehaviorButton" icon={<GearIcon/>} size="md"
                highlight={customizingBehavior}
                onClick={() => props.setOpenPanel("npcBehavior")}
            />
            <IconButton id="rotateNpcButton" icon={<RotateClockwiseIcon/>} size="md"
                disabled={!ObjectEditUtil.canQuarterTurn(props.selection)}
                onClick={() => ObjectEditUtil.tryQuarterTurn(props.selection)}
            />
        </SelectionToolRow>}
        {customizingLooks && <CustomizePlayerPanel gameObject={props.selection.gameObject} onClose={closePanel}/>}
        {customizingBehavior && <CustomizeNpcBehaviorPanel selection={props.selection} onClose={closePanel}/>}
    </div>;
}
