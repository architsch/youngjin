import { useState } from "react";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import PaletteColorInput from "../../input/paletteColorInput";
import StepperInput from "../../input/stepperInput";
import SelectionToolRow from "./selectionToolRow";
import Text from "../../basic/text";
import LampObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/lampObjectTypeConfig";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../../../shared/object/types/objectTransform";
import ObjectAttachmentUtil from "../../../../../shared/object/util/objectAttachmentUtil";
import { MAX_LAMP_INTENSITY, MAX_LAMP_RANGE, MIN_LAMP_INTENSITY,
    MIN_LAMP_RANGE } from "../../../../../shared/graphics/light/util/lampLightUtil";
import { LIGHT_COLOR_PALETTE_NAME } from "../../../../../shared/system/sharedConstants";
import ObjectEditUtil from "../../../util/objectEditUtil";
import ResizeIcon from "../../../svg/icons/resizeIcon";
import CompositionThumbnailPanel from "../../panel/compositionThumbnailPanel";
import EditOptionsProps from "../../../types/editOptionsProps";

// Each dial's values as shown; its steps are the quantities themselves (see LampLightUtil).
const INTENSITY_LABELS = getLabels(MIN_LAMP_INTENSITY, MAX_LAMP_INTENSITY);
const RANGE_LABELS = getLabels(MIN_LAMP_RANGE, MAX_LAMP_RANGE);

// Lamp tools: remove, resize (to one of its sizes, where it stands), or change its light (one stored setting
// that also colors the glow; intensity and range are separate dials, see LampLightUtil). The size list
// stacks above this row.
export default function LampEditOptions(props: EditOptionsProps)
{
    const obj = props.selection.gameObject.params;
    const [light, setLight] = useState(() => ({
        colorIndex: LampObjectTypeConfig.util.getColorIndex(obj),
        intensity: LampObjectTypeConfig.util.getIntensity(obj),
        range: LampObjectTypeConfig.util.getRange(obj),
    }));

    // Written immediately (not deferred): lamp edits are discrete, with few values.
    const apply = (edit: (next: typeof light) => void) => {
        const next = {...light};
        edit(next);
        setLight(next);
        ObjectEditUtil.trySetObjectMetadata(props.selection, ObjectMetadataKeyEnumMap.LightProperties,
            LampObjectTypeConfig.util.encodeLightProperties(next.colorIndex, next.intensity, next.range));
    };

    // Recomputed each render; zone changes and resizes re-announce the selection (see ClientVoxelManager).
    const canEdit = canEditLamp(props.selection);
    const choosingSize = props.openPanel == "compositionThumbnail";

    // Full width, so the rows can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
        {choosingSize && canEdit && <CompositionThumbnailPanel
            id="lampSizeOptions"
            objectType={LampObjectTypeConfig.objectType}
            currentCompositionIndex={LampObjectTypeConfig.util.getCompositionIndex(obj)}
            canChoose={(compositionIndex) => canResize(props.selection, compositionIndex)}
            onChoose={(compositionIndex) => tryResize(props.selection, compositionIndex)}
            onClose={() => props.setOpenPanel(null)}
        />}
        <SelectionToolRow>
            <IconButton icon={<TrashIcon/>} size="md" color="red"
                disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
                onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection, "Want to remove this?")}
            />
            <IconButton id="changeLampSizeButton" icon={<ResizeIcon/>} size="md"
                disabled={!canEdit}
                highlight={choosingSize && canEdit}
                onClick={() => props.setOpenPanel(choosingSize ? null : "compositionThumbnail")}
            />
            <div className="flex flex-row items-center gap-1 shrink-0">
                <Text content="Color" size="sm" additionalClassNames="shrink-0"/>
                <PaletteColorInput
                    paletteName={LIGHT_COLOR_PALETTE_NAME}
                    currValue={light.colorIndex}
                    setColorIndex={(index) => apply(next => next.colorIndex = index)}
                    disabled={!canEdit}
                />
            </div>
            <div className="flex flex-row items-center gap-1 shrink-0">
                <Text content="Intensity" size="sm" additionalClassNames="shrink-0"/>
                <StepperInput
                    currValue={light.intensity - MIN_LAMP_INTENSITY}
                    numValues={INTENSITY_LABELS.length}
                    labels={INTENSITY_LABELS}
                    setValue={(step) => apply(next => next.intensity = MIN_LAMP_INTENSITY + step)}
                    disabled={!canEdit}
                />
            </div>
            <div className="flex flex-row items-center gap-1 shrink-0">
                <Text content="Range" size="sm" additionalClassNames="shrink-0"/>
                <StepperInput
                    currValue={light.range - MIN_LAMP_RANGE}
                    numValues={RANGE_LABELS.length}
                    labels={RANGE_LABELS}
                    setValue={(step) => apply(next => next.range = MIN_LAMP_RANGE + step)}
                    disabled={!canEdit}
                />
            </div>
        </SelectionToolRow>
    </div>;
}

// Asked of the light's own key, so this comes down to permissions and restricted zones (see
// @docs/gameplay/restricted_zone.md). A resize is held to the same, and to where the new size fits.
function canEditLamp(selection: ObjectSelection): boolean
{
    const currentLight = selection.gameObject.params
        .metadata[ObjectMetadataKeyEnumMap.LightProperties]?.str ?? "";
    return ObjectEditUtil.canSetObjectMetadata(selection, ObjectMetadataKeyEnumMap.LightProperties,
        currentLight);
}

// Asked by the rule the server applies to the resize, so a size is offered only where it fits.
function canResize(selection: ObjectSelection, compositionIndex: number): boolean
{
    const resized = getResized(selection, compositionIndex);
    return resized != undefined && ObjectEditUtil.canSetObjectTransform(selection, resized);
}

function tryResize(selection: ObjectSelection, compositionIndex: number): void
{
    if (compositionIndex == LampObjectTypeConfig.util.getCompositionIndex(selection.gameObject.params))
        return;
    const resized = getResized(selection, compositionIndex);
    if (resized)
        ObjectEditUtil.trySetObjectTransform(selection, resized);
}

// The lamp at the size of the look at compositionIndex, where it stands.
function getResized(selection: ObjectSelection, compositionIndex: number): ObjectTransform | undefined
{
    const scale = LampObjectTypeConfig.util.getScale(compositionIndex);
    if (!scale)
        return undefined;
    const params = selection.gameObject.params;
    return ObjectAttachmentUtil.getResizedInPlace(params.objectTypeIndex, params.transform, scale);
}

function getLabels(min: number, max: number): string[]
{
    return Array.from({length: max - min + 1}, (_, i) => String(min + i));
}
