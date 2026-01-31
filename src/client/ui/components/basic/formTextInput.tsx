import TextInput from "./textInput";
import Text from "./text";

export default function FormTextInput({label, type = "text", size = "md", placeholder = "", textInput,
    filterTextInput = (str => str), setTextInput }: Props)
{
    return <div className="flex flex-row gap-1">
        <Text content={label}/>
        <TextInput
            type={type}
            size={size}
            placeholder={placeholder}
            textInput={textInput}
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
    textInput: string;
    filterTextInput?: (rawTextInput: string) => string;
    setTextInput: (newTextInput: string) => void;
}