import TextInput from "./textInput";
import Text from "../basic/text";

// Labeled text field: fills the row's width after the label, vertically centred (not stretched).
export default function FormTextInput({label, type = "text", size = "md", placeholder = "", currValue,
    filterTextInput = (str => str), setTextInput }: Props)
{
    return <div className="flex flex-row items-center gap-1 w-full">
        <Text content={label} size={size} additionalClassNames="shrink-0 whitespace-nowrap"/>
        <TextInput
            type={type}
            size={size}
            placeholder={placeholder}
            currValue={currValue}
            filterTextInput={filterTextInput}
            setTextInput={setTextInput}
            additionalClassNames="flex-1 min-w-0"
        />
    </div>
}

interface Props
{
    label: string;
    type?: "text" | "number" | "password" | "email";
    size?: "xs" | "sm" | "md" | "lg";
    placeholder?: string;
    currValue: string;
    filterTextInput?: (rawTextInput: string) => string;
    setTextInput: (newTextInput: string) => void;
}
