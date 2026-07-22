import { ReactNode } from "react";
import IconButton from "./iconButton";
import TriangleLeftIcon from "../../svg/icons/triangleLeftIcon";
import TriangleRightIcon from "../../svg/icons/triangleRightIcon";

//------------------------------------------------------------------------
// Cycles through a fixed set of consecutive values (0 .. numValues - 1) with
// a left/right arrow button pair, in the manner of a character-customization
// selector in a video game.
// Stepping past either end wraps around to the opposite end, so
// every value stays reachable from wherever the user currently is.
//
// The middle area displays 'preview' when one is supplied (e.g. an icon
// standing for the selected value); otherwise it falls back to showing the
// selection's position within the set.
//------------------------------------------------------------------------

export default function StepperInput({ currValue, numValues, setValue, preview, additionalClassNames = "" }: Props)
{
    const step = (delta: number) => {
        if (numValues > 0)
            setValue((currValue + delta + numValues) % numValues);
    };

    return <div className={`flex flex-row items-center gap-1 shrink-0 ${additionalClassNames}`}>
        <IconButton icon={<TriangleLeftIcon/>} onClick={() => step(-1)}/>
        <div className="flex items-center justify-center shrink-0 min-w-10 h-10 px-1 text-sm select-none yj-panel-gray-no-outline">
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
