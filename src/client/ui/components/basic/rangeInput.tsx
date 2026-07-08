import { FormEvent, FormEventHandler, useCallback, useEffect, useRef } from "react";
import { numActiveInputElementsObservable } from "../../../system/clientObservables";

export default function RangeInput({ currValue, setValue, min, max, step }: Props)
{
    const inputRef = useRef<HTMLInputElement>(null);

    const onChange: FormEventHandler<HTMLInputElement> = useCallback((event: FormEvent<HTMLInputElement>) => {
        setValue(event.currentTarget.value);
    }, [setValue]);

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

    // Keep the press on the slider handle from bubbling to an ancestor drag-scroll container
    // (see useMouseDragScroll), which would otherwise treat the drag as a scroll and
    // preventDefault the pointer move — leaving the handle draggable-by-click only.
    // These must be native listeners on the input itself: React delegates its synthetic
    // events at the root container (above the scroll container), so a React-level
    // stopPropagation would run only after the scroll container's own native mousedown
    // listener has already fired.
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

    return <input
        ref={inputRef}
        type="range"
        className={`w-32 h-8 p-0 shrink-0 border-2 border-gray-400 rounded-md cursor-pointer`}
        value={currValue}
        min={min}
        max={max}
        step={step}
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
function stopPropagation(event: Event)
{
    event.stopPropagation();
}

interface Props
{
    currValue: string;
    setValue: (value: string) => void;
    min: string;
    max: string;
    step: string;
}