import { FormEvent, FormEventHandler, useCallback, useEffect, useRef } from "react";
import { numActiveInputElementsObservable } from "../../../system/clientObservables";

export default function ColorInput({ currValue, setColorHex }: Props)
{
    const inputRef = useRef<HTMLInputElement>(null);

    const onChange: FormEventHandler<HTMLInputElement> = useCallback((event: FormEvent<HTMLInputElement>) => {
        setColorHex(event.currentTarget.value);
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
        type="color"
        className={`w-8 h-8 p-0 shrink-0 bg-transparent border-2 border-gray-400 rounded-md cursor-pointer`}
        value={currValue}
        onChange={onChange}
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

interface Props
{
    currValue: string;
    setColorHex: (colorHex: string) => void;
}