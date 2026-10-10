import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import PersonIcon from "../../../svg/icons/personIcon";
import RotateClockwiseIcon from "../../../svg/icons/rotateClockwiseIcon";
import ObjectEditUtil from "../../../util/objectEditUtil";
import CustomizePlayerPanel from "../../panel/customizePlayerPanel";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import NpcObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/npcObjectTypeConfig";
import { OBJECT_NAME_MAX_LENGTH } from "../../../../../shared/system/sharedConstants";
import { SUB_PANELS_BENEATH_SELECTION_TOOLS } from "../../../../system/clientConstants";
import ObjectMetadataTextInput from "./objectMetadataTextInput";
import SelectionToolRow from "./selectionToolRow";
import EditOptionsProps from "../../../types/editOptionsProps";

// Tools for a selected character. The user's own has only its looks to set. An NPC, which is an admin's to lay,
// has more: remove, its name, a clockwise quarter-turn of the way it faces, and its looks, whose panel shows
// beneath this row, or in its place until closed (see SUB_PANELS_BENEATH_SELECTION_TOOLS).
export default function PlayerEditOptions(props: EditOptionsProps)
{
    const gameObject = props.selection.gameObject;
    if (gameObject.config != NpcObjectTypeConfig)
        return <CustomizePlayerPanel gameObject={gameObject}/>;

    const customizing = props.openPanel == "playerParts";
    const toolsShown = SUB_PANELS_BENEATH_SELECTION_TOOLS || !customizing;

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
                highlight={customizing}
                onClick={() => props.setOpenPanel("playerParts")}
            />
            <IconButton id="rotateNpcButton" icon={<RotateClockwiseIcon/>} size="md"
                disabled={!ObjectEditUtil.canQuarterTurn(props.selection)}
                onClick={() => ObjectEditUtil.tryQuarterTurn(props.selection)}
            />
        </SelectionToolRow>}
        {customizing && <CustomizePlayerPanel gameObject={gameObject}
            onClose={SUB_PANELS_BENEATH_SELECTION_TOOLS ? undefined : () => props.setOpenPanel(null)}/>}
    </div>;
}
