import { FormEvent, FormEventHandler, useCallback, useEffect, useRef } from "react";
import { numActiveInputElementsObservable } from "../../../system/clientObservables";

export default function TextInput({id, type = "text", size = "md", placeholder = "", currValue,
    filterTextInput = (str => str), setTextInput, additionalClassNames = "" }: Props)
{
    const inputRef = useRef<HTMLInputElement>(null);

    // Whether this field currently counts toward active inputs.
    const isFocused = useRef<boolean>(false);

    const onInput: FormEventHandler<HTMLInputElement> = useCallback((event: FormEvent<HTMLInputElement>) => {
        const filteredTextInput = filterTextInput(event.currentTarget.value);
        setTextInput(filteredTextInput);
    }, []);

    const onFocus = useCallback(() => {
        isFocused.current = true;
        numActiveInputElementsObservable.change(n => n + 1);
    }, []);

    const onBlur = useCallback(() => {
        isFocused.current = false;
        numActiveInputElementsObservable.change(n => n - 1);
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

    // Keeps a drag that selects text from scrolling an ancestor drag-scroll container (see RangeInput).
    useEffect(() => {
        const input = inputRef.current;
        if (!input)
            return;
        input.addEventListener("mousedown", stopPropagation);
        input.addEventListener("touchstart", stopPropagation);
        return () => {
            input.removeEventListener("mousedown", stopPropagation);
            input.removeEventListener("touchstart", stopPropagation);
        };
    }, []);

    // Released on unmount while focused, as RangeInput does (e.g. a panel closed by its object's removal).
    useEffect(() => {
        return () => {
            if (isFocused.current)
                numActiveInputElementsObservable.change(n => n - 1);
        };
    }, []);

    return <input
        ref={inputRef}
        id={id}
        type={type}
        className={`text-left ${textClassNames[size]} yj-panel-white yj-surface-concave ${additionalClassNames}`}
        placeholder={placeholder}
        value={currValue}
        onInput={onInput}
        onFocus={onFocus}
        onBlur={onBlur}
    >
    </input>
}

function stopPropagation(event: Event)
{
    event.stopPropagation();
}

const textClassNames = {
    xs: "yj-text-xs",
    sm: "yj-text-sm",
    md: "yj-text-md",
    lg: "yj-text-lg",
};

interface Props
{
    // Lets automation address the field.
    id?: string;
    type?: "text" | "number" | "password" | "email";
    size?: "xs" | "sm" | "md" | "lg";
    placeholder?: string;
    currValue: string;
    filterTextInput?: (rawTextInput: string) => string;
    setTextInput: (newTextInput: string) => void;
    additionalClassNames?: string;
}