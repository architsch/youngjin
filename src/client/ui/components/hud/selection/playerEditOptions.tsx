import CustomizePlayerPanel from "../../panel/customizePlayerPanel";
import EditOptionsProps from "../../../types/editOptionsProps";
import UserIdentityRow from "./userIdentityRow";

// Tools for the user's own character: who they are, and its looks (an NPC's are NpcEditOptions).
export default function PlayerEditOptions(props: EditOptionsProps)
{
    // Full width, so the row can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
        <UserIdentityRow/>
        <CustomizePlayerPanel gameObject={props.selection.gameObject}/>
    </div>;
}
