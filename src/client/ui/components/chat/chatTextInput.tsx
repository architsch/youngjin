import { CompositionEvent, FormEvent, FormEventHandler, useEffect, useRef } from "react";
import { chatTextInputObservable, numActiveTextInputsObservable } from "../../../system/clientObservables";
import { OBJECT_MESSAGE_MAX_LENGTH } from "../../../../shared/system/sharedConstants";
import StringUtil from "../../../../shared/system/util/stringUtil";

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

    return <input
        id="chatTextInput"
        type="text"
        ref={inputRef}
        className="flex-4 m-1 p-1 justify-self-start text-left align-middle border-2 border-gray-700 rounded-md text-base text-gray-900 bg-gray-200 pointer-events-auto"
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
    numActiveTextInputsObservable.change(n => n + 1);
}

function onBlur()
{
    numActiveTextInputsObservable.change(n => n - 1);
}