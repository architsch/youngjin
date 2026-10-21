import { CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { numActiveInputElementsObservable } from "../../../system/clientObservables";
import useMouseDragScroll from "../../util/mouseDragScroll";
import ClosablePanelUtil from "../../util/closablePanelUtil";
import KeyPressUtil from "../../util/keyPressUtil";
import TriangleDownIcon from "../../svg/icons/triangleDownIcon";

const LIST_GAP = 4; // Space kept between the button and the list above it
const SCREEN_MARGIN = 8; // Space kept between the list and the screen edges
// Max travel (px) for an outside press to count as a dismissing click rather than a camera drag.
const DISMISS_MOVEMENT_TOLERANCE = 8;

// One value picked out of several, shown by its label. Pressed, it lists them all above itself, each with what it
// means if given, for one to be picked; the list closes as PaletteColorInput's palette does.
export default function DropdownInput({ id, options, currValue, setValue, disabled = false,
    additionalClassNames = "" }: Props)
{
    const [listOpen, setListOpen] = useState(false);

    // Disabling can come while the list is open (e.g. a zone drawn over the edited object).
    useEffect(() => {
        if (disabled)
            setListOpen(false);
    }, [disabled]);
    const [listStyle, setListStyle] = useState<CSSProperties | undefined>(undefined);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLDivElement | null>(null);
    const onListDragScroll = useMouseDragScroll("vertical", "grabWhileDragging");
    const onListRefChange = useCallback((node: HTMLDivElement | null) => {
        listRef.current = node;
        onListDragScroll(node);
    }, [onListDragScroll]);

    useEffect(() => {
        if (!listOpen)
            return;
        // Counts as an active input while open, and as a panel open over the controls around it (see
        // ClosablePanelUtil); Escape closes it.
        numActiveInputElementsObservable.change(n => n + 1);
        const panelToken = ClosablePanelUtil.register(() => setListOpen(false));
        const onKeyDown = (ev: KeyboardEvent) => {
            if (!KeyPressUtil.isEscape(ev))
                return;
            // Kept from the browser, whose own close request would go on to close what the list is open over (see
            // useCloseGesture).
            ev.preventDefault();
            setListOpen(false);
        };
        // An outside press closes the list only if it didn't travel (a drag orbits the camera). The button counts as
        // inside.
        let pressPos: {x: number, y: number} | undefined;
        const onPointerDown = (ev: PointerEvent) => {
            const target = ev.target as Node | null;
            const pressedList = (target != null) && ((listRef.current?.contains(target) == true)
                || (buttonRef.current?.contains(target) == true));
            pressPos = pressedList ? undefined : {x: ev.clientX, y: ev.clientY};
        };
        const onPointerUp = (ev: PointerEvent) => {
            if (pressPos != undefined
                && Math.hypot(ev.clientX - pressPos.x, ev.clientY - pressPos.y) <= DISMISS_MOVEMENT_TOLERANCE)
                setListOpen(false);
            pressPos = undefined;
        };
        const onPointerCancel = () => {
            pressPos = undefined;
        };
        window.addEventListener("keydown", onKeyDown);
        // Capturing, so that these readings do not depend on what the pressed element does with the event.
        window.addEventListener("pointerdown", onPointerDown, true);
        window.addEventListener("pointerup", onPointerUp, true);
        window.addEventListener("pointercancel", onPointerCancel, true);
        return () => {
            numActiveInputElementsObservable.change(n => n - 1);
            ClosablePanelUtil.unregister(panelToken);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("pointerdown", onPointerDown, true);
            window.removeEventListener("pointerup", onPointerUp, true);
            window.removeEventListener("pointercancel", onPointerCancel, true);
        };
    }, [listOpen]);

    useLayoutEffect(() => {
        const button = buttonRef.current;
        if (!listOpen || button == null)
        {
            setListStyle(undefined);
            return;
        }
        // Over the button, from its left edge as far as the screen allows, height-capped to stay on screen.
        const reposition = () => {
            const buttonRect = button.getBoundingClientRect();
            const listWidth = listRef.current?.offsetWidth ?? 0;
            const left = Math.max(SCREEN_MARGIN, Math.min(buttonRect.left,
                window.innerWidth - SCREEN_MARGIN - listWidth));
            const bottom = window.innerHeight - buttonRect.top + LIST_GAP;
            const maxHeight = Math.max(0, buttonRect.top - LIST_GAP - SCREEN_MARGIN);
            // Unchanged style avoids re-renders while scrolling the list.
            setListStyle(prevStyle => (prevStyle != undefined && prevStyle.left == left && prevStyle.bottom == bottom
                && prevStyle.maxHeight == maxHeight) ? prevStyle : {left, bottom, maxHeight,
                maxWidth: window.innerWidth - 2 * SCREEN_MARGIN});
        };
        reposition();
        // Re-anchor whenever the button moves.
        window.addEventListener("resize", reposition);
        window.addEventListener("scroll", reposition, true); // Capturing, so that scrolling ancestors count too
        return () => {
            window.removeEventListener("resize", reposition);
            window.removeEventListener("scroll", reposition, true);
        };
    }, [listOpen]);

    const current = options.find(option => option.value == currValue);

    return <>
        <button
            ref={buttonRef}
            id={id}
            className={`flex flex-row items-center gap-1 h-10 pl-2 pr-1 shrink-0 rounded-md cursor-pointer select-none touch-manipulation text-sm bg-gray-700 text-gray-200 yj-surface-concave disabled:opacity-50 disabled:cursor-not-allowed ${additionalClassNames}`}
            disabled={disabled}
            onClick={() => setListOpen(prev => !prev)}
        >
            {/* Laid out invisibly in the label's grid cell, so the width never changes with the value (which would
                shift the controls beside it). */}
            <span className="grid text-left">
                {options.map(option =>
                    <span key={option.value} className="col-start-1 row-start-1 invisible">{option.label}</span>)}
                <span className="col-start-1 row-start-1">{current?.label ?? NO_VALUE_LABEL}</span>
            </span>
            <span className="size-4 shrink-0"><TriangleDownIcon/></span>
        </button>
        {listOpen &&
            // Positioning frame only; pointer-events-none so the canvas still receives drags.
            <div className="fixed inset-0 z-50 pointer-events-none">
                {/* The list stays hidden until measured, so that it never flashes at an unanchored spot. */}
                <div ref={onListRefChange}
                    className={`absolute p-2 flex flex-col gap-1 bg-gray-700 rounded-lg overflow-y-auto pointer-events-auto yj-surface-convex ${(listStyle == undefined) ? "invisible" : ""}`}
                    style={listStyle}>
                    {options.map(option =>
                        <button
                            key={option.value}
                            id={(id != undefined) ? `${id}.${option.value}` : undefined}
                            className={`flex flex-col items-start shrink-0 px-2 py-1 text-left cursor-pointer select-none touch-manipulation yj-panel-gray ${(option.value == currValue) ? "yj-panel-highlight" : ""}`}
                            onClick={() => {
                                setValue(option.value);
                                setListOpen(false);
                            }}
                        >
                            <span className="text-sm">{option.label}</span>
                            {option.description != undefined &&
                                <span className="text-xs opacity-75">{option.description}</span>}
                        </button>)}
                </div>
            </div>}
    </>;
}

const NO_VALUE_LABEL = "–";

interface Props
{
    // Lets automation address the button, and each option by it, then a dot, then the option's value.
    id?: string;
    options: {value: string, label: string, description?: string}[];
    currValue: string; // One of the options' values, or none of them for none
    setValue: (value: string) => void;
    // Shown but not adjustable, e.g. where this user may not make the edit.
    disabled?: boolean;
    additionalClassNames?: string;
}
