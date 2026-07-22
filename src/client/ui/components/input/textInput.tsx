import { FormEvent, FormEventHandler, useCallback, useEffect, useRef } from "react";
import { numActiveInputElementsObservable } from "../../../system/clientObservables";

export default function TextInput({type = "text", size = "md", placeholder = "", currValue,
    filterTextInput = (str => str), setTextInput }: Props)
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
        value={currValue}
        onInput={onInput}
        onFocus={onFocus}
        onBlur={onBlur}
    >
    </input>
}

function onFocus()
{
    numActiveInputElementsObservable.change(n => n + 1);
}
function onBlur()
{
    numActiveInputElementsObservable.change(n => n - 1);
}

const textClassNames = {
    xs: "yj-text-xs",
    sm: "yj-text-sm",
    md: "yj-text-md",
    lg: "yj-text-lg",
};

interface Props
{
    type?: "text" | "number" | "password" | "email";
    size?: "xs" | "sm" | "md" | "lg";
    placeholder?: string;
    currValue: string;
    filterTextInput?: (rawTextInput: string) => string;
    setTextInput: (newTextInput: string) => void;
}