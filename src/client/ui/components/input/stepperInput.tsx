import { ReactNode } from "react";
import IconButton from "./iconButton";
import TriangleLeftIcon from "../../svg/icons/triangleLeftIcon";
import TriangleRightIcon from "../../svg/icons/triangleRightIcon";

// Wrap-around stepper over 0..numValues-1 with left/right arrows (like a character-creator selector).
// Shows `preview` if given, otherwise the position in the set.

export default function StepperInput({ currValue, numValues, setValue, preview, additionalClassNames = "" }: Props)
{
    const step = (delta: number) => {
        if (numValues > 0)
            setValue((currValue + delta + numValues) % numValues);
    };

    return <div className={`flex flex-row items-center gap-1 shrink-0 ${additionalClassNames}`}>
        <IconButton icon={<TriangleLeftIcon/>} onClick={() => step(-1)}/>
        {/* Sunken: it holds the value, it isn't pressable. */}
        <div className="flex items-center justify-center shrink-0 min-w-10 h-10 px-1 text-sm select-none rounded-md bg-gray-700 text-gray-200 yj-surface-concave">
            {preview ?? `${currValue + 1}/${numValues}`}
        </div>
        <IconButton icon={<TriangleRightIcon/>} onClick={() => step(1)}/>
    </div>
}

interface Props
{
    currValue: number; // Index within the set of selectable values
    numValues: number;
    setValue: (value: number) => void;
    preview?: ReactNode;
    additionalClassNames?: string;
}
