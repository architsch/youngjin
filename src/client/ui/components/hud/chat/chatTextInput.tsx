import { CompositionEvent, FormEvent, FormEventHandler, useEffect, useRef } from "react";
import { chatTextInputObservable, numActiveInputElementsObservable } from "../../../../system/clientObservables";
import { OBJECT_MESSAGE_MAX_LENGTH } from "../../../../../shared/system/sharedConstants";
import StringUtil from "../../../../../shared/math/util/stringUtil";

export default function ChatTextInput({textInput, setTextInput}
    : {textInput: string, setTextInput: (newTextInput: string) => void})
{
    const inputRef = useRef<HTMLInputElement>(null);

    // Uncontrolled input: a controlled value breaks IME (CJK) composition. External changes (e.g.
    // clearing after send) are synced one-way here.
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

    // min-w-0 removes the default intrinsic width, so the field (not the Send button) shrinks on phones.
    return <input
        id="chatTextInput"
        type="text"
        ref={inputRef}
        className="flex-4 min-w-0 m-1 px-2 h-10 justify-self-start text-left align-middle rounded-md text-base text-gray-900 bg-gray-200 pointer-events-auto yj-surface-concave"
        onInput={onInput}
        onCompositionEnd={onCompositionEnd}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="Your Message"
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