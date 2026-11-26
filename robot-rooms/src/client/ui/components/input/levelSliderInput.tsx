import RangeInput from "./rangeInput";
import Text from "../basic/text";

// A labeled slider over a few named levels (e.g. low, medium, high), with the name of the one it is at beside it.
export default function LevelSliderInput({ id, label, levelLabels, currLevel, setLevel }: Props)
{
    return <div className="flex flex-row items-center gap-2 w-full">
        <Text content={label} size="sm" additionalClassNames="w-32 shrink-0"/>
        <RangeInput
            id={id}
            currValue={`${currLevel}`}
            setValue={value => setLevel(Number(value))}
            min="0"
            max={`${levelLabels.length - 1}`}
            step="1"
            showValueInput={false}
            additionalClassNames="w-28"
        />
        <Text content={levelLabels[currLevel]} size="sm" color="green" additionalClassNames="w-16 shrink-0"/>
    </div>
}

interface Props
{
    id?: string;
    label: string;
    // One per level, from the lowest.
    levelLabels: string[];
    currLevel: number;
    setLevel: (level: number) => void;
}
