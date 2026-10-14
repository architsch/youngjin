import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import StepperInput from "../../input/stepperInput";
import SelectionToolRow from "./selectionToolRow";
import Text from "../../basic/text";
import FanObjectTypeConfig, { FAN_RANGES,
    FAN_STRENGTHS } from "../../../../../shared/object/types/objectTypeConfig/fanObjectTypeConfig";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import ObjectEditUtil from "../../../util/objectEditUtil";
import EditOptionsProps from "../../../types/editOptionsProps";

// Each dial's values as shown, which are the settings themselves (see FanObjectTypeConfig).
const STRENGTH_LABELS = FAN_STRENGTHS.map(String);
const RANGE_LABELS = FAN_RANGES.map(String);

// Fan tools: remove, or change its wind (one stored setting: how hard it pushes, and how far it reaches).
export default function FanEditOptions(props: EditOptionsProps)
{
    // Read off the fan each render, as every edit of it re-announces the selection (see ClientObjectManager): its
    // own, one undone, or somebody else's.
    const metadata = props.selection.gameObject.params.metadata;
    const wind = {
        strength: FanObjectTypeConfig.util.getStrength(metadata),
        range: FanObjectTypeConfig.util.getRange(metadata),
    };

    // Written immediately (not deferred): fan edits are discrete, with few values.
    const apply = (edit: (next: typeof wind) => void) => {
        const next = {...wind};
        edit(next);
        ObjectEditUtil.trySetObjectMetadata(props.selection, ObjectMetadataKeyEnumMap.ForceProperties,
            FanObjectTypeConfig.util.encodeForceProperties(next.strength, next.range));
    };

    // Recomputed each render; zone changes re-announce the selection (see ClientVoxelManager).
    const canEdit = canEditFan(props.selection);

    return <SelectionToolRow>
        <IconButton id="removeFanButton" icon={<TrashIcon/>} size="md" color="red" shortcutKey="Delete"
            disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
            onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection, "Want to remove this?")}
        />
        <div className="flex flex-row items-center gap-1 shrink-0">
            <Text content="Strength" size="sm" additionalClassNames="shrink-0"/>
            <StepperInput
                currValue={FAN_STRENGTHS.indexOf(wind.strength)}
                numValues={FAN_STRENGTHS.length}
                labels={STRENGTH_LABELS}
                setValue={(step) => apply(next => next.strength = FAN_STRENGTHS[step])}
                disabled={!canEdit}
            />
        </div>
        <div className="flex flex-row items-center gap-1 shrink-0">
            <Text content="Range" size="sm" additionalClassNames="shrink-0"/>
            <StepperInput
                currValue={FAN_RANGES.indexOf(wind.range)}
                numValues={FAN_RANGES.length}
                labels={RANGE_LABELS}
                setValue={(step) => apply(next => next.range = FAN_RANGES[step])}
                disabled={!canEdit}
            />
        </div>
    </SelectionToolRow>;
}

// Asked of the wind's own key, so this comes down to permissions and restricted zones (see
// @docs/gameplay/restricted_zone.md).
function canEditFan(selection: ObjectSelection): boolean
{
    const currentWind = selection.gameObject.params
        .metadata[ObjectMetadataKeyEnumMap.ForceProperties]?.str ?? "";
    return ObjectEditUtil.canSetObjectMetadata(selection, ObjectMetadataKeyEnumMap.ForceProperties, currentWind);
}
