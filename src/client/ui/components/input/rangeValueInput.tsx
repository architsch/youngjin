import { FormEvent, FormEventHandler, useCallback, useEffect, useRef, useState } from "react";
import RangeValueUtil from "../../util/rangeValueUtil";
import { numActiveInputElementsObservable } from "../../../system/clientObservables";

// The number a slider is currently standing on, written out beside it and typeable.
//
// A slider says where a setting sits *within its range* and nothing else: it cannot be read off, it
// cannot be returned to exactly, and it cannot be told to somebody. This field is the same setting
// in the other language — one the user can read, copy and type back — and the two being one setting
// rather than two is the whole of what it has to get right:
//
//   - **The handle moves, the number follows.** Dragging is by far the commoner gesture, so what is
//     shown here answers it live, mid-drag included.
//   - **The number is typed, the handle follows.** Answered on every keystroke rather than when the
//     field is left, so that the two are never seen disagreeing. A keystroke that does not make a
//     number — a half-typed value, a stray letter — simply does not move the handle, and leaving the
//     field puts back whatever the handle is actually standing on. There is nothing to undo and no
//     error to report: the setting was never changed.
//
// What is typed survives until the field is left, rather than being rewritten as it is typed:
// a field that reformatted itself mid-word would be fighting the user for the caret. Leaving it is
// where the two are made to agree again — see RangeValueUtil for both of the rules that settles it
// by.
export default function RangeValueInput({ currValue, setValue, min, max, step }: Props)
{
    const inputRef = useRef<HTMLInputElement>(null);
    const [text, setText] = useState<string>(() => RangeValueUtil.format(currValue));

    // Whether the count of active inputs currently holds this one, which is the same thing as the
    // caret still standing in this field (see the unmount cleanup below).
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

    // Keep the press on this field from reaching an ancestor drag-scroll container (see
    // useMouseDragScroll), which would otherwise read the drag across the field as a drag along the
    // tray it stands in — scrolling the tools sideways instead of selecting the text, and
    // preventDefault-ing the pointer move so that nothing in the field can be selected at all. The
    // slider beside it needs the same guard for the same reason; see RangeInput, whose note explains
    // why these have to be native listeners rather than React's own.
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

    // Give the count of active inputs back on the way out, for a field taken off screen while the
    // caret still stands in it — a popup something else closed, or a selection that went away. An
    // element removed from the document is never told it lost focus, so nothing else would ever hand
    // this back, and a count left standing at one is read app-wide as the user typing into
    // something: movement keys stop answering for the rest of the session.
    useEffect(() => {
        return () => {
            if (isFocused.current)
                numActiveInputElementsObservable.change(n => n - 1);
        };
    }, []);

    // Kept out of the row's shrinking (see RangeInput): the track is what gives way when the row
    // runs out of width, since a number squeezed to nothing says nothing at all. Sunken and a shade
    // darker than the panel it stands on, like every other thing in the app that holds a value the
    // user put there.
    return <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        className="shrink-0 w-12 h-8 px-1 text-sm text-center text-gray-200 cursor-text bg-gray-700 rounded-md yj-surface-concave"
        value={text}
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
    // The same bounds the slider was given, as numbers: this field has to know which values the
    // slider actually has in order to take a typed one down to one of them.
    min: number;
    max: number;
    step: number;
}
