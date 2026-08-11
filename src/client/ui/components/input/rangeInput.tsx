import { FormEvent, FormEventHandler, useCallback, useEffect, useRef } from "react";
import { numActiveInputElementsObservable } from "../../../system/clientObservables";

export default function RangeInput({ currValue, setValue, min, max, step, additionalClassNames = "" }: Props)
{
    const inputRef = useRef<HTMLInputElement>(null);

    // Whether the count of active inputs currently holds this one, which is the same thing as the
    // handle still being in the user's hands (see the unmount cleanup below).
    const isFocused = useRef<boolean>(false);

    const onChange: FormEventHandler<HTMLInputElement> = useCallback((event: FormEvent<HTMLInputElement>) => {
        setValue(event.currentTarget.value);
    }, [setValue]);

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

    // Give the count of active inputs back on the way out, for the slider that is taken off screen
    // while the user still has hold of it — which is what happens to one belonging to a mode the
    // user leaves, or to a popup something else closes. An element removed from the document is
    // never told it lost focus, so nothing else would ever hand this back, and a count left standing
    // at one is read app-wide as the user typing into something: movement keys stop answering and
    // the Escape gesture stops closing anything, for the rest of the session.
    useEffect(() => {
        return () => {
            if (isFocused.current)
                numActiveInputElementsObservable.change(n => n - 1);
        };
    }, []);

    // The browser draws the track and the handle itself, and left to its own devices draws them in
    // its accent color — the one blue thing in an app that has nothing else blue in it. The accent
    // named here is the app's own, the green its controls already wear.
    return <input
        ref={inputRef}
        type="range"
        className={`h-8 p-0 rounded-md cursor-pointer accent-green-600 yj-surface-concave ${additionalClassNames}`}
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
    // How wide the track is, and whether it may shrink, are the caller's to say: a slider in a form
    // is given a fixed width and holds it, while one sharing a row with something that must stay
    // whole gives way to it. Only the height is fixed here, so sliders line up wherever they meet.
    additionalClassNames?: string;
}