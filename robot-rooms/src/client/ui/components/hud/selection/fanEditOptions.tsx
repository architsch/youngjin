import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import PaletteColorInput from "../../input/paletteColorInput";
import StepperInput from "../../input/stepperInput";
import SelectionToolRow from "./selectionToolRow";
import Text from "../../basic/text";
import FanObjectTypeConfig, { FAN_COLOR_PALETTE_NAME,
    FAN_SETTINGS } from "../../../../../shared/object/types/objectTypeConfig/fanObjectTypeConfig";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import ObjectEditUtil from "../../../util/objectEditUtil";
import EditOptionsProps from "../../../types/editOptionsProps";

const BLADES_LABELS = FAN_SETTINGS.map(setting => String(setting.blades));

// Fan tools: remove, paint it (in tin's colors, its housing and its wind alike), or change how many blades it has,
// which sets how hard its wind pushes and how far it reaches (see FanObjectTypeConfig).
export default function FanEditOptions(props: EditOptionsProps)
{
    // Read off the fan each render, as every edit of it re-announces the selection (see ClientObjectManager): its
    // own, one undone, or somebody else's.
    const metadata = props.selection.gameObject.params.metadata;
    const colorIndex = FanObjectTypeConfig.util.getColorIndex(metadata);
    const setting = FanObjectTypeConfig.util.getSetting(metadata);

    // Recomputed each render; zone changes re-announce the selection (see ClientVoxelManager).
    const canEditColor = canEditFan(props.selection, ObjectMetadataKeyEnumMap.FanColor);
    const canEditSetting = canEditFan(props.selection, ObjectMetadataKeyEnumMap.ForceProperties);

    return <SelectionToolRow>
        <IconButton id="removeFanButton" icon={<TrashIcon/>} size="md" color="red" shortcutKey="Delete"
            disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
            onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection, "Want to remove this?")}
        />
        <div className="flex flex-row items-center gap-1 shrink-0">
            <Text content="Color" size="sm" additionalClassNames="shrink-0"/>
            <PaletteColorInput
                paletteName={FAN_COLOR_PALETTE_NAME}
                currValue={colorIndex}
                setColorIndex={(index) => ObjectEditUtil.trySetObjectMetadata(props.selection,
                    ObjectMetadataKeyEnumMap.FanColor, FanObjectTypeConfig.util.encodeColor(index))}
                disabled={!canEditColor}
            />
        </div>
        <div className="flex flex-row items-center gap-1 shrink-0">
            <Text content="Blades" size="sm" additionalClassNames="shrink-0"/>
            <StepperInput
                currValue={FAN_SETTINGS.indexOf(setting)}
                numValues={FAN_SETTINGS.length}
                labels={BLADES_LABELS}
                // Written immediately (not deferred): fan edits are discrete, with few values.
                setValue={(step) => ObjectEditUtil.trySetObjectMetadata(props.selection,
                    ObjectMetadataKeyEnumMap.ForceProperties,
                    FanObjectTypeConfig.util.encodeForceProperties(FAN_SETTINGS[step]))}
                disabled={!canEditSetting}
            />
        </div>
    </SelectionToolRow>;
}

// Asked of the value's own key, so this comes down to permissions and restricted zones (see
// @docs/gameplay/restricted_zone.md).
function canEditFan(selection: ObjectSelection, metadataKey: ObjectMetadataKey): boolean
{
    const currentValue = selection.gameObject.params.metadata[metadataKey]?.str ?? "";
    return ObjectEditUtil.canSetObjectMetadata(selection, metadataKey, currentValue);
}
