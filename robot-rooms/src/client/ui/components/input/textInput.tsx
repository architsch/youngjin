import { FormEvent, KeyboardEvent as ReactKeyboardEvent, RefObject, useCallback, useEffect, useLayoutEffect,
    useRef } from "react";
import { numActiveInputElementsObservable } from "../../../system/clientObservables";

export default function TextInput({id, type = "text", size = "md", placeholder = "", currValue,
    filterTextInput = (str => str), setTextInput, onEnter, fieldRef, maxVisibleLines, additionalClassNames = "" }: Props)
{
    // An input, or a textarea when the field is multiline.
    const ownRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
    const inputRef = fieldRef ?? ownRef;
    const multiline = maxVisibleLines != undefined;

    // Whether this field currently counts toward active inputs.
    const isFocused = useRef<boolean>(false);

    const onInput = useCallback((event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

    // Given onEnter, Enter is the field's alone: no other listener hears it (the chat's send among them), and the field
    // keeps the keyboard for what is typed next. Not while an IME composes, whose Enter only ends the composition.
    const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (onEnter == undefined || event.key != "Enter" || event.nativeEvent.isComposing)
            return;
        event.stopPropagation();
        onEnter();
    };

    // In a multiline field Enter starts a new line, so only Escape leaves it.
    const onKeyDown = useCallback((ev: KeyboardEvent) =>
    {
        if ((ev.key == "Escape" || (ev.key == "Enter" && !multiline)) && inputRef.current)
            inputRef.current.blur();
    }, [multiline]);

    useEffect(() => {
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [onKeyDown]);

    // Keeps a drag that selects text from scrolling an ancestor drag-scroll container (see RangeInput),
    // and a multiline field's Enter from reaching window-level handlers (e.g. ChatSendButton's send).
    useEffect(() => {
        const input = inputRef.current;
        if (!input)
            return;
        input.addEventListener("mousedown", stopPropagation);
        input.addEventListener("touchstart", stopPropagation);
        if (multiline)
            input.addEventListener("keydown", stopEnterPropagation);
        return () => {
            input.removeEventListener("mousedown", stopPropagation);
            input.removeEventListener("touchstart", stopPropagation);
            input.removeEventListener("keydown", stopEnterPropagation);
        };
    }, [multiline]);

    // Released on unmount while focused, as RangeInput does (e.g. a panel closed by its object's removal).
    useEffect(() => {
        return () => {
            if (isFocused.current)
                numActiveInputElementsObservable.change(n => n - 1);
        };
    }, []);

    // A multiline field grows with its text up to maxVisibleLines, then scrolls. Sizing is border-box, and
    // scrollHeight leaves out the border.
    useLayoutEffect(() => {
        const input = inputRef.current;
        if (!input || maxVisibleLines == undefined)
            return;
        const style = getComputedStyle(input);
        const borderHeight = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
        const lineHeight = parseFloat(style.lineHeight) || 1.2 * parseFloat(style.fontSize); // "normal" is NaN
        const maxHeight = maxVisibleLines * lineHeight + parseFloat(style.paddingTop)
            + parseFloat(style.paddingBottom) + borderHeight;
        input.style.height = "auto";
        const contentHeight = input.scrollHeight + borderHeight;
        input.style.height = `${Math.min(contentHeight, maxHeight)}px`;
        input.style.overflowY = (contentHeight > maxHeight) ? "auto" : "hidden";
    }, [currValue, maxVisibleLines]);

    const className = `text-left ${textClassNames[size]} yj-panel-white yj-surface-concave`;
    if (multiline)
    {
        return <textarea
            ref={inputRef}
            id={id}
            rows={1}
            className={`${className} resize-none ${additionalClassNames}`}
            placeholder={placeholder}
            value={currValue}
            onInput={onInput}
            onFocus={onFocus}
            onBlur={onBlur}
        >
        </textarea>
    }
    return <input
        ref={inputRef}
        id={id}
        type={type}
        className={`${className} ${additionalClassNames}`}
        placeholder={placeholder}
        value={currValue}
        onInput={onInput}
        onKeyDown={onInputKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
    >
    </input>
}

function stopPropagation(event: Event)
{
    event.stopPropagation();
}

function stopEnterPropagation(event: KeyboardEvent)
{
    if (event.key == "Enter")
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
    // Ignored by a multiline field.
    type?: "text" | "number" | "password" | "email";
    size?: "xs" | "sm" | "md" | "lg";
    placeholder?: string;
    currValue: string;
    filterTextInput?: (rawTextInput: string) => string;
    setTextInput: (newTextInput: string) => void;
    // What Enter in the field does. Ignored by a multiline field, where Enter starts a new line.
    onEnter?: () => void;
    // The field itself, for an owner that gives it the keyboard or takes it away.
    fieldRef?: RefObject<(HTMLInputElement & HTMLTextAreaElement) | null>;
    // Makes the field multiline: its text wraps instead of scrolling sideways, Enter starts a new line, and
    // it grows up to this many lines before scrolling.
    maxVisibleLines?: number;
    additionalClassNames?: string;
}
