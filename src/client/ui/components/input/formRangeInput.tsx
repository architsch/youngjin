import RangeInput from "./rangeInput";
import Text from "../basic/text";

export default function FormRangeInput({ label, currValue, setValue, min, max, step }: Props)
{
    // The label keeps its width and the track gives way, so that a row too wide for the form is
    // narrowed rather than broken across two lines (see RangeInput).
    return <div className="flex flex-row items-center gap-1 min-w-0">
        <Text content={label} additionalClassNames="shrink-0"/>
        <RangeInput
            currValue={currValue}
            setValue={setValue}
            min={min}
            max={max}
            step={step}
            additionalClassNames="w-32"
        />
    </div>
}

interface Props
{
    label: string;
    currValue: string;
    setValue: (value: string) => void;
    min: string;
    max: string;
    step: string;
}
