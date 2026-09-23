import Text from "../basic/text";
import ColorUtil from "../../../../shared/math/util/colorUtil";
import Vec3 from "../../../../shared/math/types/vec3";
import MouldingCompositionConstants from "../../../../shared/graphics/mesh/composition/types/compositionConstants/mouldingCompositionConstants";
import StepperInput from "./stepperInput";
import PaletteColorInput from "./paletteColorInput";
import RangeInput from "./rangeInput";

// The finish of a moulded wood frame: its colors, band width and profile. Uses the joinery palette, as
// doors do (see ColorPaletteMap).
const COLOR_PALETTE_NAME = "Timber";

export default function MouldingInput(props: Props)
{
    return <>
        {props.colorSlots.map(slot =>
            <div key={"color-slot-" + slot.title} className="flex flex-row items-stretch gap-3 shrink-0">
                <div className="flex flex-row items-center gap-1 shrink-0">
                    <Text content={slot.title} size="sm"/>
                    <PaletteColorInput
                        paletteName={COLOR_PALETTE_NAME}
                        currValue={ColorUtil.rgbToPaletteIndex(COLOR_PALETTE_NAME, slot.color)}
                        setColorIndex={(index: number) =>
                            slot.setColor(ColorUtil.paletteIndexToRGB(COLOR_PALETTE_NAME, index))}
                    />
                </div>
                <div className="w-px self-stretch bg-gray-500"/>
            </div>
        )}
        <div className="flex flex-col items-center gap-1 shrink-0">
            <Text content="Thickness" size="sm"/>
            {/* Judged by eye, so no value field (see RangeInput). */}
            <RangeInput
                currValue={String(props.mouldingThickness)}
                setValue={(value: string) => props.setMouldingThickness(Number(value))}
                min={String(MouldingCompositionConstants.minMouldingThickness)}
                max={String(MouldingCompositionConstants.maxMouldingThickness)}
                step={String(MouldingCompositionConstants.mouldingThicknessStep)}
                showValueInput={false}
                additionalClassNames="w-28"
            />
        </div>
        <div className="w-px self-stretch shrink-0 bg-gray-500"/>
        <div className="flex flex-col items-center gap-1 shrink-0">
            <Text content="Profile" size="sm"/>
            <StepperInput
                currValue={props.mouldingIsConvex ? 0 : 1}
                numValues={2}
                setValue={(value: number) => props.setMouldingIsConvex(value == 0)}
                labels={["Convex", "Concave"]}
            />
        </div>
    </>;
}

interface Props
{
    colorSlots: {title: string, color: Vec3, setColor: (color: Vec3) => void}[];
    mouldingThickness: number;
    setMouldingThickness: (mouldingThickness: number) => void;
    mouldingIsConvex: boolean;
    setMouldingIsConvex: (mouldingIsConvex: boolean) => void;
}
