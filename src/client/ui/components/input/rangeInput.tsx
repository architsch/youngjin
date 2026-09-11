import { FormEvent, FormEventHandler, useCallback, useEffect, useRef } from "react";
import RangeValueInput from "./rangeValueInput";
import { numActiveInputElementsObservable } from "../../../system/clientObservables";

// A setting chosen by dragging a handle along a track, with the number the handle is standing on
// written out beside it (see RangeValueInput) — the pairing is the default, since a slider alone
// cannot be read off and a field alone cannot be swept through.
//
// The number is dropped only where it would be a readout of nothing: a setting the user judges by
// what it does rather than by the figure it stands at, and that nobody would ever want to type,
// note down or tell somebody. There the field costs width and attention and gives back a number
// that means nothing on its own — see CameraZoomSlider, the one such setting so far.
//
// A slider whose whole range is a handful of values also carries a mark for each of them. Below
// that count the marks are what say the setting is chosen from a short list rather than swept
// continuously, and where each of its values lies; above it they would be a texture rather than a
// scale, and are left off. They are never labelled — the number beside the track is the readout
// wherever there is one, and a row of little numbers under a slider is unreadable at this size.
export default function RangeInput({ currValue, setValue, min, max, step, showValueInput = true,
    orientation = "horizontal", additionalClassNames = "" }: Props)
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

    const minValue = Number(min);
    const maxValue = Number(max);
    const stepValue = Number(step);

    // The row never wraps, and what gives way when it runs out of width is the track: the number
    // beside it, where there is one, is the one part that says nothing at all once it has been
    // squeezed.
    //
    // Stood upright, the track runs from its least value at the foot to its greatest at the head —
    // the way anything measured upward reads — which a track turned by the vertical writing mode only
    // does when it is also told to run right-to-left.
    const vertical = orientation == "vertical";
    return <div className={`flex ${vertical ? "flex-col" : "flex-row"} flex-nowrap items-center gap-1 min-w-0`}>
        <div className={`relative flex items-center min-w-0 ${additionalClassNames}`}>
            {/* The browser draws the track and the handle itself, and left to its own devices draws
                them in its accent color — the one blue thing in an app that has nothing else blue in
                it. The accent named here is the app's own, the green its controls already wear. */}
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

// The marks under the track, one per value the slider has, laid out across the travel of the handle
// rather than across the whole element — the handle's own width is the difference, and it is held
// back at each end so that the first and last marks sit under the handle's two resting places.
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

// Where a scale stops being a scale. A dozen marks are still countable at a glance and still stand
// apart on a track a couple of finger-widths wide; more of them read as hatching, and say only that
// the setting is finely divided — which the absence of marks says just as well.
const MAX_TICK_MARKS = 12;

interface Props
{
    currValue: string;
    setValue: (value: string) => void;
    min: string;
    max: string;
    step: string;
    // Whether the number the handle is standing on is written out beside the track. Shown unless the
    // caller says otherwise: dropping the readout is the exception, and one that has to be asked for.
    showValueInput?: boolean;
    // Which way the track runs. Level unless the caller says otherwise: a slider standing upright is
    // one kept to a narrow strip at the edge of the screen (see CameraZoomSlider), and carries no
    // tick marks, which are laid out along a level track only.
    orientation?: "horizontal" | "vertical";
    // How wide the track is, and whether it may shrink, are the caller's to say: a slider in a form
    // is given a width and holds it until the row runs out of room, while one sharing a row with
    // something that must stay whole gives way to it sooner. Only the height is fixed here, so
    // sliders line up wherever they meet.
    additionalClassNames?: string;
}
