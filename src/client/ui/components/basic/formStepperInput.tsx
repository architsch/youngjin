import { ReactNode } from "react";
import StepperInput from "./stepperInput";
import Text from "./text";

export default function FormStepperInput({ label, currValue, numValues, setValue, preview }: Props)
{
    return <div className="flex flex-row items-center gap-1">
        <Text content={label}/>
        <StepperInput
            currValue={currValue}
            numValues={numValues}
            setValue={setValue}
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
    preview?: ReactNode;
}
