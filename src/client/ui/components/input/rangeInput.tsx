import { FormEvent, FormEventHandler, useCallback, useEffect, useRef } from "react";
import RangeValueInput from "./rangeValueInput";
import { numActiveInputElementsObservable } from "../../../system/clientObservables";

// Slider with an editable value field (see RangeValueInput); the field is omitted only for settings
// judged by eye (e.g. CameraZoomSlider). Short ranges (<= MAX_TICK_MARKS values) get unlabeled ticks.
export default function RangeInput({ currValue, setValue, min, max, step, showValueInput = true,
    orientation = "horizontal", additionalClassNames = "" }: Props)
{
    const inputRef = useRef<HTMLInputElement>(null);

    // Whether this slider currently counts toward active inputs.
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

    // Native listeners stop presses reaching an ancestor drag-scroll container (see
    // useMouseDragScroll), which would hijack the drag. React's delegated stopPropagation runs too late.
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

    // Release the active-input count on unmount while held: removed elements get no blur, and a stuck
    // count disables movement keys and Escape for the session.
    useEffect(() => {
        return () => {
            if (isFocused.current)
                numActiveInputElementsObservable.change(n => n - 1);
        };
    }, []);

    const minValue = Number(min);
    const maxValue = Number(max);
    const stepValue = Number(step);

    // The track shrinks rather than wrapping. Vertical tracks need rtl so the minimum is at the bottom.
    const vertical = orientation == "vertical";
    return <div className={`flex ${vertical ? "flex-col" : "flex-row"} flex-nowrap items-center gap-1 min-w-0`}>
        <div className={`relative flex items-center min-w-0 ${additionalClassNames}`}>
            {/* Override the browser's default (blue) accent with the app's green. */}
            <input
                ref={inputRef}
                type="range"
                className={`${vertical ? "w-8 h-full [writing-mode:vertical-lr] [direction:rtl]" : "w-full h-8"} p-0 rounded-md cursor-pointer accent-green-600 yj-surface-concave`}
                value={currValue}
                min={min}
                max={max}
                step={step}
                onChange={onChange}
                onFocus={onFocus}
                onBlur={onBlur}
            >
            </input>
            {!vertical && renderTickMarks(minValue, maxValue, stepValue)}
        </div>
        {showValueInput &&
            <RangeValueInput
                currValue={currValue}
                setValue={setValue}
                min={minValue}
                max={maxValue}
                step={stepValue}
            />}
    </div>
}

// Ticks span the handle's travel (inset by half the handle width at each end).
function renderTickMarks(min: number, max: number, step: number)
{
    const numValues = getNumValues(min, max, step);
    if (numValues < 2 || numValues > MAX_TICK_MARKS)
        return null;

    return <div className="absolute inset-x-0 bottom-0.5 flex flex-row justify-between px-1.75 pointer-events-none">
        {Array.from({length: numValues}, (_, i) =>
            <div key={i} className="w-px h-1.5 rounded-full bg-white/40"/>)}
    </div>
}

function getNumValues(min: number, max: number, step: number): number
{
    if (!Number.isFinite(min) || !Number.isFinite(max) || !(step > 0) || max <= min)
        return 0;
    return Math.floor((max - min) / step) + 1;
}

function stopPropagation(event: Event)
{
    event.stopPropagation();
}

// Beyond this many values, ticks read as hatching.
const MAX_TICK_MARKS = 12;

interface Props
{
    currValue: string;
    setValue: (value: string) => void;
    min: string;
    max: string;
    step: string;
    // Defaults to true.
    showValueInput?: boolean;
    // Vertical sliders (e.g. CameraZoomSlider) have no tick marks.
    orientation?: "horizontal" | "vertical";
    // Width and shrink behavior are up to the caller; height is fixed so sliders align.
    additionalClassNames?: string;
}
