import TextInput from "./textInput";
import Text from "../basic/text";

export default function FormTextInput({label, type = "text", size = "md", placeholder = "", currValue,
    filterTextInput = (str => str), setTextInput }: Props)
{
    return <div className="flex flex-row gap-1">
        <Text content={label}/>
        <TextInput
            type={type}
            size={size}
            placeholder={placeholder}
            currValue={currValue}
            filterTextInput={filterTextInput}
            setTextInput={setTextInput}
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