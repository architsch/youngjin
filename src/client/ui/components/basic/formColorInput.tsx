import ColorInput from "./colorInput";
import Text from "./text";

export default function FormColorInput({ label, currValue, setColorHex }: Props)
{
    return <div className="flex flex-row gap-1">
        <Text content={label}/>
        <ColorInput
            currValue={currValue}
            setColorHex={setColorHex}
        />
    </div>
}

interface Props
{
    label: string;
    currValue: string;
    setColorHex: (colorHex: string) => void;
}