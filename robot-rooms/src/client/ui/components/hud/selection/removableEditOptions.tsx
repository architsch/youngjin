import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import SelectionToolRow from "./selectionToolRow";
import ObjectEditUtil from "../../../util/objectEditUtil";
import EditOptionsProps from "../../../types/editOptionsProps";

// The tools of a thing that is only ever taken away again (a pet's scrap): removing it, for whoever may (its pet's
// owner, or an admin; see PetScrapObjectTypeConfig).
export default function RemovableEditOptions(props: EditOptionsProps)
{
    if (!ObjectEditUtil.canRemoveObject(props.selection))
        return null;
    return <SelectionToolRow>
        <IconButton id="removeObjectButton" icon={<TrashIcon/>} size="md" color="red" shortcutKey="Delete"
            onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection, "Want to remove this?")}
        />
    </SelectionToolRow>;
}
