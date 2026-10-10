import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import ObjectEditUtil from "../../../util/objectEditUtil";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import { OBJECT_NAME_MAX_LENGTH, OBJECT_USER_NAME_MAX_LENGTH,
    ZONE_USER_NAME_FOR_NOBODY } from "../../../../../shared/system/sharedConstants";
import ObjectMetadataTextInput from "./objectMetadataTextInput";
import SelectionToolRow from "./selectionToolRow";
import EditOptionsProps from "../../../types/editOptionsProps";

// The tools for a selected volume: remove, the name it is found by, and the user it is kept for (or "*" for
// nobody), which makes it a restricted zone (see RestrictedZoneUtil). Its size is set by its outline's corners
// (see VolumeEditGizmos).
export default function VolumeEditOptions(props: EditOptionsProps)
{
    return <SelectionToolRow>
        <IconButton id="removeVolumeButton" icon={<TrashIcon/>} size="md" color="red" shortcutKey="Delete"
            disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
            onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection, "Want to remove this volume?")}
        />
        <ObjectMetadataTextInput id="volumeNameInput" selection={props.selection}
            metadataKey={ObjectMetadataKeyEnumMap.Label} maxLength={OBJECT_NAME_MAX_LENGTH}
            placeholder="Volume name" additionalClassNames="w-44"/>
        <ObjectMetadataTextInput id="volumeZoneUserNameInput" selection={props.selection}
            metadataKey={ObjectMetadataKeyEnumMap.ZoneUserName} maxLength={OBJECT_USER_NAME_MAX_LENGTH}
            placeholder={`Allowed user (${ZONE_USER_NAME_FOR_NOBODY} = none)`} additionalClassNames="w-60"/>
    </SelectionToolRow>;
}
