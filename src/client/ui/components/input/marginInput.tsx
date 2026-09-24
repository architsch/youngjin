import Text from "../basic/text";
import MarginCompositionConstants from "../../../../shared/graphics/mesh/composition/types/compositionConstants/marginCompositionConstants";
import RangeInput from "./rangeInput";

// How far inside its footprint a framed panel (a canvas or a label) is drawn (see
// MarginCompositionConstants).
export default function MarginInput(props: Props)
{
    return <div className="flex flex-col items-center gap-1 shrink-0">
        <Text content="Margin" size="sm"/>
        {/* Judged by eye, so no value field (see RangeInput). */}
        <RangeInput
            currValue={String(props.margin)}
            setValue={(value: string) => props.setMargin(Number(value))}
            min="0"
            max={String(MarginCompositionConstants.maxMargin)}
            step={String(MarginCompositionConstants.marginStep)}
            showValueInput={false}
            additionalClassNames="w-28"
        />
    </div>;
}

interface Props
{
    margin: number;
    setMargin: (margin: number) => void;
}
