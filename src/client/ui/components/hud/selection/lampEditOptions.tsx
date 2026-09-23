import { useState } from "react";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import PaletteColorInput from "../../input/paletteColorInput";
import RangeInput from "../../input/rangeInput";
import SelectionToolRow from "./selectionToolRow";
import Text from "../../basic/text";
import LampObjectTypeConfig from "../../../../../shared/object/types/objectTypeConfig/lampObjectTypeConfig";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import { MAX_LAMP_INTENSITY, MAX_LAMP_RANGE, MIN_LAMP_INTENSITY,
    MIN_LAMP_RANGE } from "../../../../../shared/graphics/light/util/lampLightUtil";
import { LIGHT_COLOR_PALETTE_NAME } from "../../../../../shared/system/sharedConstants";
import ObjectEditUtil from "../../../util/objectEditUtil";
import PictureFrameIcon from "../../../svg/icons/pictureFrameIcon";
import CustomizeFramePanel from "../../panel/customizeFramePanel";
import LampCompositionConstants from "../../../../../shared/graphics/mesh/composition/types/compositionConstants/lampCompositionConstants";
import EditOptionsProps from "../../../types/editOptionsProps";

// Input bounds as strings; the ranges are short enough to tick every value (see LampLightUtil).
const MIN_INTENSITY_ATTRIBUTE = String(MIN_LAMP_INTENSITY);
const MAX_INTENSITY_ATTRIBUTE = String(MAX_LAMP_INTENSITY);
const MIN_RANGE_ATTRIBUTE = String(MIN_LAMP_RANGE);
const MAX_RANGE_ATTRIBUTE = String(MAX_LAMP_RANGE);

const LOOK_PANEL = "look";

// Lamp tools: remove, change its look (margin and frame), or change its light (one stored setting that
// also colors the glow; intensity and range are separate dials, see LampLightUtil). The look bar stacks
// above this row.
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

    // Recomputed each render; zone changes re-announce the selection (see ClientVoxelManager).
    const canCustomize = canCustomizeLamp(props.selection);
    const customizing = props.openPanel == LOOK_PANEL;

    // Full width, so the rows can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
        {customizing && canCustomize && <CustomizeFramePanel
            id="customizeLampOptions"
            selection={props.selection}
            colorSlots={[{title: "Frame", key: "frame"}]}
            presets={LampCompositionConstants.presets}
            onClose={() => props.setOpenPanel(null)}
        />}
        <SelectionToolRow>
            <IconButton icon={<TrashIcon/>} size="md" color="red"
                disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
                onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection, "Want to remove this?")}
            />
            <IconButton id="changeLampLookButton" icon={<PictureFrameIcon/>} size="md"
                disabled={!canCustomize}
                highlight={customizing && canCustomize}
                onClick={() => props.setOpenPanel(customizing ? null : LOOK_PANEL)}
            />
            <div className="flex flex-row items-center gap-1 shrink-0">
                <Text content="Color" size="sm" additionalClassNames="shrink-0"/>
                <PaletteColorInput
                    paletteName={LIGHT_COLOR_PALETTE_NAME}
                    currValue={light.colorIndex}
                    setColorIndex={(index) => apply(next => next.colorIndex = index)}
                />
            </div>
            <div className="flex flex-row items-center gap-1 shrink-0">
                <Text content="Intensity" size="sm" additionalClassNames="shrink-0"/>
                <RangeInput
                    currValue={String(light.intensity)}
                    setValue={(value) => apply(next => next.intensity = Number(value))}
                    min={MIN_INTENSITY_ATTRIBUTE} max={MAX_INTENSITY_ATTRIBUTE} step="1"
                    additionalClassNames="w-28"
                />
            </div>
            <div className="flex flex-row items-center gap-1 shrink-0">
                <Text content="Range" size="sm" additionalClassNames="shrink-0"/>
                <RangeInput
                    currValue={String(light.range)}
                    setValue={(value) => apply(next => next.range = Number(value))}
                    min={MIN_RANGE_ATTRIBUTE} max={MAX_RANGE_ATTRIBUTE} step="1"
                    additionalClassNames="w-28"
                />
            </div>
        </SelectionToolRow>
    </div>;
}

// Asked of the look's own key, so this comes down to permissions and restricted zones (see
// @docs/gameplay/restricted_zone.md).
function canCustomizeLamp(selection: ObjectSelection): boolean
{
    const currentLook = selection.gameObject.params
        .metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition]?.str ?? "";
    return ObjectEditUtil.canSetObjectMetadata(selection, ObjectMetadataKeyEnumMap.InstancedMeshComposition,
        currentLook);
}
