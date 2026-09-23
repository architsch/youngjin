import { FormEvent, FormEventHandler, useCallback, useEffect, useRef, useState } from "react";
import RangeValueUtil from "../../util/rangeValueUtil";
import { numActiveInputElementsObservable } from "../../../system/clientObservables";

// Typeable value for a slider. Dragging updates the number live; typing updates the handle on each
// keystroke when the text parses (otherwise nothing changes). Typed text isn't reformatted until
// blur, which restores agreement (see RangeValueUtil).
export default function RangeValueInput({ currValue, setValue, min, max, step, disabled = false }: Props)
{
    const inputRef = useRef<HTMLInputElement>(null);
    const [text, setText] = useState<string>(() => RangeValueUtil.format(currValue));

    // Whether this field currently counts toward active inputs.
    const isFocused = useRef<boolean>(false);

    // Follow the handle wherever it goes — dragged, or moved by a gesture elsewhere in the app.
    useEffect(() => {
        if (!isFocused.current)
            setText(RangeValueUtil.format(currValue));
    }, [currValue]);

    const onInput: FormEventHandler<HTMLInputElement> = useCallback(
        (event: FormEvent<HTMLInputElement>) => {
            const typed = event.currentTarget.value;
            setText(typed);
            const value = RangeValueUtil.parse(typed, min, max, step);
            if (value !== null)
                setValue(String(value));
        }, [setValue, min, max, step]);

    const onFocus = useCallback(() => {
        isFocused.current = true;
        numActiveInputElementsObservable.change(n => n + 1);
    }, []);

    const onBlur = useCallback(() => {
        isFocused.current = false;
        numActiveInputElementsObservable.change(n => n - 1);
        setText(RangeValueUtil.format(currValue));
    }, [currValue]);

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

    // Native listeners stop presses reaching an ancestor drag-scroll container (see RangeInput).
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

    // Release the active-input count on unmount while focused (see RangeInput).
    useEffect(() => {
        return () => {
            if (isFocused.current)
                numActiveInputElementsObservable.change(n => n - 1);
        };
    }, []);

    // Doesn't shrink (the track does); sunken style marks a user-set value.
    return <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        className="shrink-0 w-12 h-8 px-1 text-sm text-center text-gray-200 cursor-text bg-gray-700 rounded-md yj-surface-concave disabled:opacity-50 disabled:cursor-not-allowed"
        value={text}
        disabled={disabled}
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

interface Props
{
    // The slider's own value, as it holds it — a string, since that is what an <input> deals in.
    currValue: string;
    setValue: (value: string) => void;
    // The slider's bounds, for snapping typed values.
    min: number;
    max: number;
    step: number;
    disabled?: boolean;
}
