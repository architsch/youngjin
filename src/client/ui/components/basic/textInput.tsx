import { FormEvent, FormEventHandler, useCallback, useEffect, useRef } from "react";
import { numActiveTextInputsObservable } from "../../../system/clientObservables";

export default function TextInput({type = "text", size = "md", placeholder = "", textInput,
    filterTextInput = (str => str), setTextInput }: TextInputProps)
{
    const inputRef = useRef<HTMLInputElement>(null);

    const onInput: FormEventHandler<HTMLInputElement> = useCallback((event: FormEvent<HTMLInputElement>) => {
        const filteredTextInput = filterTextInput(event.currentTarget.value);
        setTextInput(filteredTextInput);
    }, []);

    const onKeyDown = useCallback((ev: KeyboardEvent) =>
    {
        if ((ev.key == "Enter" || ev.key == "Escape") && inputRef.current)
            inputRef.current.blur();
    }, []);

    useEffect(() => {
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, []);

    return <input
        ref={inputRef}
        type={type}
        className={`text-left ${textClassNames[size]} yj-panel-white`}
        placeholder={placeholder}
        value={textInput}
        onInput={onInput}
        onFocus={onFocus}
        onBlur={onBlur}
    >
    </input>
}

function onFocus()
{
    numActiveTextInputsObservable.change(n => n + 1);
}
function onBlur()
{
    numActiveTextInputsObservable.change(n => n - 1);
}

const textClassNames = {
    xs: "yj-text-xs",
    sm: "yj-text-sm",
    md: "yj-text-md",
    lg: "yj-text-lg",
};

interface TextInputProps
{
    type?: "text" | "number" | "password" | "email";
    size?: "xs" | "sm" | "md" | "lg";
    placeholder?: string;
    textInput: string;
    filterTextInput?: (rawTextInput: string) => string;
    setTextInput: (newTextInput: string) => void;
}