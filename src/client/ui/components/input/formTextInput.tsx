import TextInput from "./textInput";
import Text from "../basic/text";

// A text field with its question written beside it.
//
// The row takes the whole width it is offered and gives the field whatever the label leaves over, so
// the field is never a stub floating in a wide form nor wide enough to push its way out of a narrow
// one. And the field is centred rather than stretched: a one-line field grown as tall as the label
// beside it happens to be reads as a text area, which is not what it is.
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
