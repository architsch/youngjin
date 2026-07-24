import { CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ColorUtil from "../../../../shared/math/util/colorUtil";
import { numActiveInputElementsObservable } from "../../../system/clientObservables";
import useMouseDragScroll from "../../util/mouseDragScroll";

const PALETTE_GAP = 4; // Space kept between the button and the palette above it
const SCREEN_MARGIN = 8; // Space kept between the palette and the screen edges
// The palette hugs the left screen edge, so its width decides how much of the middle of the
// screen — where the player's body is being previewed — stays uncovered while a color is picked.
// A horizontal screen has enough room to the left of the player for a wider grid; a vertical
// screen does not, so it gets a narrow grid that scrolls instead.
const PALETTE_COLUMNS_ON_HORIZONTAL_SCREEN = 4;
const PALETTE_COLUMNS_ON_VERTICAL_SCREEN = 2;
// How far a press outside the palette may travel and still be read as a click that
// dismisses the palette, rather than as a drag of the screen behind it (in pixels).
const DISMISS_MOVEMENT_TOLERANCE = 8;

export default function Base94ColorInput({ currValue, setColorIndex }: Props)
{
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [paletteStyle, setPaletteStyle] = useState<CSSProperties | undefined>(undefined);
    const [paletteColumns, setPaletteColumns] = useState(PALETTE_COLUMNS_ON_HORIZONTAL_SCREEN);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const paletteRef = useRef<HTMLDivElement | null>(null);
    const onPaletteDragScroll = useMouseDragScroll("vertical", "grabWhileDragging");
    const onPaletteRefChange = useCallback((node: HTMLDivElement | null) => {
        paletteRef.current = node;
        onPaletteDragScroll(node);
    }, [onPaletteDragScroll]);

    useEffect(() => {
        if (!paletteOpen)
            return;
        // While the palette is open, count it as an active input element
        // (like a focused input field), and let the Escape key close it.
        numActiveInputElementsObservable.change(n => n + 1);
        const onKeyDown = (ev: KeyboardEvent) => {
            if (ev.key == "Escape")
                setPaletteOpen(false);
        };
        // A press that lands outside the palette closes it too — but only once it ends
        // without having travelled, since a press that travels is the user dragging the
        // screen behind the palette to orbit the self-view camera, and that drag must
        // not cost them the palette they are picking a color from. The button counts as
        // part of the palette here, so that its own toggling stays the only thing that
        // decides what a press on it does.
        let pressPos: {x: number, y: number} | undefined;
        const onPointerDown = (ev: PointerEvent) => {
            const target = ev.target as Node | null;
            const pressedPalette = (target != null) && ((paletteRef.current?.contains(target) == true)
                || (buttonRef.current?.contains(target) == true));
            pressPos = pressedPalette ? undefined : {x: ev.clientX, y: ev.clientY};
        };
        const onPointerUp = (ev: PointerEvent) => {
            if (pressPos != undefined
                && Math.hypot(ev.clientX - pressPos.x, ev.clientY - pressPos.y) <= DISMISS_MOVEMENT_TOLERANCE)
                setPaletteOpen(false);
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
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("pointerdown", onPointerDown, true);
            window.removeEventListener("pointerup", onPointerUp, true);
            window.removeEventListener("pointercancel", onPointerCancel, true);
        };
    }, [paletteOpen]);

    useLayoutEffect(() => {
        const button = buttonRef.current;
        if (!paletteOpen || button == null)
        {
            setPaletteStyle(undefined);
            return;
        }
        // Anchor the palette between the left screen edge and the top edge of the button,
        // capping its height so that its own top edge stays below the top screen edge
        // instead of being cut off there.
        const reposition = () => {
            const buttonRect = button.getBoundingClientRect();
            const bottom = window.innerHeight - buttonRect.top + PALETTE_GAP;
            const maxHeight = Math.max(0, buttonRect.top - PALETTE_GAP - SCREEN_MARGIN);
            setPaletteColumns((window.innerHeight > window.innerWidth)
                ? PALETTE_COLUMNS_ON_VERTICAL_SCREEN : PALETTE_COLUMNS_ON_HORIZONTAL_SCREEN);
            // Kept identical while nothing moved, so that scrolling the palette itself
            // (which the capturing listener below also hears) costs no re-render.
            setPaletteStyle(prevStyle => (prevStyle != undefined && prevStyle.bottom == bottom
                && prevStyle.maxHeight == maxHeight)
                ? prevStyle : {left: SCREEN_MARGIN, bottom, maxHeight});
        };
        reposition();
        // Re-anchor whenever the button moves.
        window.addEventListener("resize", reposition);
        window.addEventListener("scroll", reposition, true); // Capturing, so that scrolling ancestors count too
        return () => {
            window.removeEventListener("resize", reposition);
            window.removeEventListener("scroll", reposition, true);
        };
    }, [paletteOpen]);

    const renderSwatch = (index: number) => {
        // The selected swatch is marked by a white outer border with a dark ring just inside it.
        // The dark ring keeps the swatch's own color from ever touching the white border, so the
        // border is only ever judged against the panel behind it — which makes the mark equally
        // readable on a white swatch and on a black one.
        return <button
            key={"swatch-" + index}
            className={`w-10 h-10 shrink-0 rounded-md cursor-pointer select-none touch-manipulation border-2 ${(index == currValue) ? "border-white shadow-[inset_0_0_0_2px_#000000]" : "border-gray-600"}`}
            style={{backgroundColor: ColorUtil.rgbToHex(ColorUtil.base94IndexToRGB(index))}}
            onClick={() => {
                setColorIndex(index);
                setPaletteOpen(false);
            }}
        />;
    };

    return <>
        <button
            ref={buttonRef}
            className="w-8 h-6 p-0 shrink-0 border-2 border-gray-400 rounded-md cursor-pointer select-none touch-manipulation"
            style={{backgroundColor: ColorUtil.rgbToHex(ColorUtil.base94IndexToRGB(currValue))}}
            onClick={() => setPaletteOpen(prev => !prev)}
        />
        {paletteOpen &&
            // The overlay only gives the palette a screen-sized frame to be anchored in; it takes
            // no pointer input of its own, so that everything it covers — the game canvas above
            // all, where a drag orbits the self-view camera — keeps receiving presses as usual.
            <div className="fixed inset-0 z-50 pointer-events-none">
                {/* The palette stays hidden until measured, so that it never flashes at an unanchored spot. */}
                <div ref={onPaletteRefChange}
                    className={`absolute p-2 flex flex-col gap-0.5 bg-gray-700 rounded-lg overflow-y-auto pointer-events-auto ${(paletteStyle == undefined) ? "invisible" : ""}`}
                    style={paletteStyle}>
                    {Array.from({length: Math.ceil(ColorUtil.base94PaletteSize / paletteColumns)}, (_, rowIndex) =>
                        <div key={"palette-row-" + rowIndex} className="flex flex-row gap-0.5">
                            {Array.from({length: paletteColumns}, (_, columnIndex) =>
                                rowIndex * paletteColumns + columnIndex)
                                .filter(index => index < ColorUtil.base94PaletteSize)
                                .map(index => renderSwatch(index))}
                        </div>)}
                </div>
            </div>}
    </>;
}

interface Props
{
    currValue: number; // Index in the base-94 color palette (see ColorUtil)
    setColorIndex: (index: number) => void;
}
