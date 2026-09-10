import { CompositionEvent, FormEvent, FormEventHandler, useEffect, useRef } from "react";
import { chatTextInputObservable, numActiveInputElementsObservable } from "../../../../system/clientObservables";
import { OBJECT_MESSAGE_MAX_LENGTH } from "../../../../../shared/system/sharedConstants";
import StringUtil from "../../../../../shared/math/util/stringUtil";

export default function ChatTextInput({textInput, setTextInput}
    : {textInput: string, setTextInput: (newTextInput: string) => void})
{
    const inputRef = useRef<HTMLInputElement>(null);

    // The input is uncontrolled (defaultValue + ref). A controlled value={textInput} would
    // force React to overwrite the DOM on every render, which disrupts IME composition
    // and drops characters in CJK input. We sync external textInput changes (e.g. the
    // parent clearing the field after send) one-way via this effect.
    useEffect(() => {
        if (inputRef.current && inputRef.current.value !== textInput)
            inputRef.current.value = textInput;
    }, [textInput]);

    const commit = (rawValue: string) => {
        const truncated = StringUtil.truncateByCodePoints(rawValue, OBJECT_MESSAGE_MAX_LENGTH);
        if (truncated !== rawValue && inputRef.current)
            inputRef.current.value = truncated;
        setTextInput(truncated);
        chatTextInputObservable.set(truncated);
    };

    const onInput: FormEventHandler<HTMLInputElement> = (event: FormEvent<HTMLInputElement>) => {
        commit(event.currentTarget.value);
    };

    const onCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
        commit(event.currentTarget.value);
    };

    const onKeyDown = (ev: KeyboardEvent) =>
    {
        if ((ev.key == "Enter" || ev.key == "Escape") && !ev.isComposing && inputRef.current)
            inputRef.current.blur();
    };

    useEffect(() => {
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, []);

    // min-w-0 overrides the intrinsic minimum width an input carries by default (about twenty
    // characters), which would otherwise push the Send button onto its own row on a narrow phone.
    // The field absorbs all of the shrinking for the chat row, down to nothing if it has to — a
    // clipped placeholder is a better trade than a wrapped row.
    return <input
        id="chatTextInput"
        type="text"
        ref={inputRef}
        className="flex-4 min-w-0 m-1 px-2 h-10 justify-self-start text-left align-middle rounded-md text-base text-gray-900 bg-gray-200 pointer-events-auto yj-surface-concave"
        onInput={onInput}
        onCompositionEnd={onCompositionEnd}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="Your Message Here"
        defaultValue={textInput}>
    </input>;
}

function onFocus()
{
    numActiveInputElementsObservable.change(n => n + 1);
}

function onBlur()
{
    numActiveInputElementsObservable.change(n => n - 1);
}