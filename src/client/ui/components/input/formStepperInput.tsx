import { ReactNode } from "react";
import StepperInput from "./stepperInput";
import Text from "../basic/text";

export default function FormStepperInput({ label, currValue, numValues, setValue, labels, preview }: Props)
{
    return <div className="flex flex-row items-center gap-1">
        <Text content={label}/>
        <StepperInput
            currValue={currValue}
            numValues={numValues}
            setValue={setValue}
            labels={labels}
            preview={preview}
        />
    </div>
}

interface Props
{
    label: string;
    currValue: number; // Index within the set of selectable values
    numValues: number;
    setValue: (value: number) => void;
    labels?: string[]; // One per value
    preview?: ReactNode;
}
