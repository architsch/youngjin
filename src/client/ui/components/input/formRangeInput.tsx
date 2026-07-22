import RangeInput from "./rangeInput";
import Text from "../basic/text";

export default function FormRangeInput({ label, currValue, setValue, min, max, step }: Props)
{
    return <div className="flex flex-row gap-1">
        <Text content={label}/>
        <RangeInput
            currValue={currValue}
            setValue={setValue}
            min={min}
            max={max}
            step={step}
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