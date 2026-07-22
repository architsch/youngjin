import Base94ColorInput from "./base94ColorInput";
import Text from "../basic/text";

export default function FormBase94ColorInput({ label, currValue, setColorIndex }: Props)
{
    return <div className="flex flex-row gap-1">
        <Text content={label}/>
        <Base94ColorInput
            currValue={currValue}
            setColorIndex={setColorIndex}
        />
    </div>
}

interface Props
{
    label: string;
    currValue: number; // Index in the base-94 color palette (see ColorUtil)
    setColorIndex: (index: number) => void;
}
