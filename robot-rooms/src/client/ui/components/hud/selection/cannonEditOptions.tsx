import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import RotateClockwiseIcon from "../../../svg/icons/rotateClockwiseIcon";
import ToggleSwitchInput from "../../input/toggleSwitchInput";
import SelectionToolRow from "./selectionToolRow";
import { CannonPhaseEnumMap } from "../../../../../shared/object/types/cannonPhase";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import CannonStateUtil from "../../../../../shared/object/util/cannonStateUtil";
import ObjectEditUtil from "../../../util/objectEditUtil";
import EditOptionsProps from "../../../types/editOptionsProps";

// Cannon tools: switch it off and on, and once it is scrap, which has no switch, turn it a quarter clockwise or remove it
// (see CannonObjectTypeConfig).
export default function CannonEditOptions(props: EditOptionsProps)
{
    // Read off the cannon each render, as every throw of its switch re-announces the selection (see
    // ClientObjectManager), as does its turning to scrap: the user's own throw, one undone, or somebody else's.
    const {on, phase} = CannonStateUtil.getObjectState(props.selection.gameObject.params);
    const scrap = phase == CannonPhaseEnumMap.Scrap;
    const setSwitch = (value: boolean) => ObjectEditUtil.trySetObjectMetadata(props.selection,
        ObjectMetadataKeyEnumMap.CannonState, CannonStateUtil.encodeSwitch(value));

    return <SelectionToolRow>
        {scrap && <IconButton id="removeCannonButton" icon={<TrashIcon/>} size="md" color="red" shortcutKey="Delete"
            disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
            onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection, "Want to remove this?")}
        />}
        {!scrap && <ToggleSwitchInput id="cannonSwitch" checked={on} onChange={setSwitch}
            // Recomputed each render; zone changes re-announce the selection (see ClientVoxelManager).
            disabled={!ObjectEditUtil.canSetObjectMetadata(props.selection, ObjectMetadataKeyEnumMap.CannonState,
                CannonStateUtil.encodeSwitch(!on))}
        />}
        {scrap && <IconButton id="rotateCannonScrapButton" icon={<RotateClockwiseIcon/>}
            size="md" disabled={!ObjectEditUtil.canQuarterTurn(props.selection)}
            onClick={() => ObjectEditUtil.tryQuarterTurn(props.selection)}
        />}
    </SelectionToolRow>;
}
