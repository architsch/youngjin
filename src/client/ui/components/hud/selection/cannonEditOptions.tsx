import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import ToggleSwitchInput from "../../input/toggleSwitchInput";
import SelectionToolRow from "./selectionToolRow";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import CannonStateUtil from "../../../../../shared/object/util/cannonStateUtil";
import ObjectEditUtil from "../../../util/objectEditUtil";
import EditOptionsProps from "../../../types/editOptionsProps";

// Cannon tools: remove it, with whatever balls it has left, or switch it off and on (see CannonObjectTypeConfig).
export default function CannonEditOptions(props: EditOptionsProps)
{
    // Read off the cannon each render, as every throw of its switch re-announces the selection (see
    // ClientObjectManager): the user's own, one undone, or somebody else's.
    const on = CannonStateUtil.getObjectState(props.selection.gameObject.params).on;
    const setSwitch = (value: boolean) => ObjectEditUtil.trySetObjectMetadata(props.selection,
        ObjectMetadataKeyEnumMap.CannonState, CannonStateUtil.encodeSwitch(value));

    return <SelectionToolRow>
        <IconButton id="removeCannonButton" icon={<TrashIcon/>} size="md" color="red" shortcutKey="Delete"
            disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
            onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection, "Want to remove this?")}
        />
        <ToggleSwitchInput id="cannonSwitch" checked={on} onChange={setSwitch}
            // Recomputed each render; zone changes re-announce the selection (see ClientVoxelManager).
            disabled={!ObjectEditUtil.canSetObjectMetadata(props.selection, ObjectMetadataKeyEnumMap.CannonState,
                CannonStateUtil.encodeSwitch(!on))}
        />
    </SelectionToolRow>;
}
