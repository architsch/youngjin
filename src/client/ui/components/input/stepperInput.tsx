import { ReactNode } from "react";
import IconButton from "./iconButton";
import TriangleLeftIcon from "../../svg/icons/triangleLeftIcon";
import TriangleRightIcon from "../../svg/icons/triangleRightIcon";

// Wrap-around stepper over 0..numValues-1 with left/right arrows (like a character-creator selector).
// Shows `preview` if given (it must keep one size), otherwise the value's label: by default its position.

export default function StepperInput({ currValue, numValues, setValue, labels, preview, disabled = false,
    additionalClassNames = "" }: Props)
{
    const step = (delta: number) => {
        if (numValues <= 0)
            return;
        if (currValue < 0)
            setValue((delta > 0) ? 0 : numValues - 1);
        else
            setValue((currValue + delta + numValues) % numValues);
    };

    const label = (currValue < 0) ? NO_VALUE_LABEL
        : labels ? labels[currValue] : `${currValue + 1}/${numValues}`;
    // Laid out invisibly in the label's grid cell, so the width never changes with the value (which would
    // shift the controls beside it). Digits are tabular, so the last position is as wide as any.
    const sizingLabels = [...(labels ?? [`${numValues}/${numValues}`]), NO_VALUE_LABEL];

    return <div className={`flex flex-row items-center gap-1 shrink-0 ${additionalClassNames}`}>
        <IconButton icon={<TriangleLeftIcon/>} disabled={disabled} onClick={() => step(-1)}/>
        {/* Sunken: it holds the value, it isn't pressable. */}
        <div className={`grid place-items-center shrink-0 min-w-10 h-10 px-1 text-sm tabular-nums select-none rounded-md bg-gray-700 text-gray-200 yj-surface-concave ${disabled ? "opacity-50" : ""}`}>
            {preview ?? <>
                {sizingLabels.map((sizingLabel, index) =>
                    <span key={index} className="col-start-1 row-start-1 invisible">{sizingLabel}</span>)}
                <span className="col-start-1 row-start-1">{label}</span>
            </>}
        </div>
        <IconButton icon={<TriangleRightIcon/>} disabled={disabled} onClick={() => step(1)}/>
    </div>
}

const NO_VALUE_LABEL = "–";

interface Props
{
    currValue: number; // Index within the set of selectable values, or -1 for none
    numValues: number;
    setValue: (value: number) => void;
    labels?: string[]; // One per value
    preview?: ReactNode;
    // Shown but not adjustable, e.g. where this user may not make the edit.
    disabled?: boolean;
    additionalClassNames?: string;
}
