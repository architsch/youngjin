import CustomizePlayerPanel from "../../panel/customizePlayerPanel";
import EditOptionsProps from "../../../types/editOptionsProps";

// Tools for the user's own character, which has only its looks to set (an NPC's are NpcEditOptions).
export default function PlayerEditOptions(props: EditOptionsProps)
{
    return <CustomizePlayerPanel gameObject={props.selection.gameObject}/>;
}
