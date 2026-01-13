import { FormEvent, FormEventHandler, useEffect, useRef } from "react";
import { numActiveTextInputsObservable } from "../../../system/clientObservables";

export default function ChatTextInput({textInput, setTextInput}
    : {textInput: string, setTextInput: (newTextInput: string) => void})
{
    const inputRef = useRef<HTMLInputElement>(null);

    const onInput: FormEventHandler<HTMLInputElement> = (event: FormEvent<HTMLInputElement>) => {
        setTextInput(event.currentTarget.value.substring(0, 32));
    };

    const onKeyDown = (ev: KeyboardEvent) =>
    {
        if ((ev.key == "Enter" || ev.key == "Escape") && inputRef.current)
            inputRef.current.blur();
    };

    useEffect(() => {
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, []);

    return <input
        type="text"
        ref={inputRef}
        className="flex-4 m-1 p-1 justify-self-start text-left align-middle border-2 border-gray-700 text-base text-gray-900 bg-gray-200 pointer-events-auto"
        onInput={onInput}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="Your Message Here"
        value={textInput}>
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