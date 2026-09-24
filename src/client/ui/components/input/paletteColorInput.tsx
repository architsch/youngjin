import { CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ColorUtil from "../../../../shared/math/util/colorUtil";
import { ColorPaletteName } from "../../../../shared/math/maps/colorPaletteMap";
import { numActiveInputElementsObservable } from "../../../system/clientObservables";
import useMouseDragScroll from "../../util/mouseDragScroll";

const PALETTE_GAP = 4; // Space kept between the button and the palette above it
const SCREEN_MARGIN = 8; // Space kept between the palette and the screen edges
// Palette columns: wider on landscape screens; narrow and scrolling on portrait, to keep the preview
// visible.
const PALETTE_COLUMNS_ON_HORIZONTAL_SCREEN = 4;
const PALETTE_COLUMNS_ON_VERTICAL_SCREEN = 2;
// Max travel (px) for an outside press to count as a dismissing click rather than a camera drag.
const DISMISS_MOVEMENT_TOLERANCE = 8;

// Palette contents depend on what is painted (see ColorPaletteMap).
export default function PaletteColorInput({ paletteName, currValue, setColorIndex, disabled = false }: Props)
{
    const paletteSize = ColorUtil.getPaletteSize(paletteName);

    const [paletteOpen, setPaletteOpen] = useState(false);

    // Disabling can come while the palette is open (e.g. a zone drawn over the edited object).
    useEffect(() => {
        if (disabled)
            setPaletteOpen(false);
    }, [disabled]);
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
        // Counts as an active input while open; Escape closes it.
        numActiveInputElementsObservable.change(n => n + 1);
        const onKeyDown = (ev: KeyboardEvent) => {
            if (ev.key == "Escape")
                setPaletteOpen(false);
        };
        // An outside press closes the palette only if it didn't travel (a drag orbits the camera).
        // The toggle button counts as inside.
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
        // Anchored between the left edge and the button top, height-capped to stay on screen.
        const reposition = () => {
            const buttonRect = button.getBoundingClientRect();
            const bottom = window.innerHeight - buttonRect.top + PALETTE_GAP;
            const maxHeight = Math.max(0, buttonRect.top - PALETTE_GAP - SCREEN_MARGIN);
            setPaletteColumns((window.innerHeight > window.innerWidth)
                ? PALETTE_COLUMNS_ON_VERTICAL_SCREEN : PALETTE_COLUMNS_ON_HORIZONTAL_SCREEN);
            // Unchanged style avoids re-renders while scrolling the palette.
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
        // Selected: white border with a dark inner ring, readable on any swatch color.
        return <button
            key={"swatch-" + index}
            className={`w-10 h-10 shrink-0 rounded-md cursor-pointer select-none touch-manipulation border-2 ${(index == currValue) ? "border-white shadow-[inset_0_0_0_2px_#000000]" : "border-gray-600"}`}
            style={{backgroundColor: ColorUtil.rgbToHex(ColorUtil.paletteIndexToRGB(paletteName, index))}}
            onClick={() => {
                setColorIndex(index);
                setPaletteOpen(false);
            }}
        />;
    };

    return <>
        <button
            ref={buttonRef}
            className="w-8 h-6 p-0 shrink-0 rounded-md cursor-pointer select-none touch-manipulation yj-surface-concave disabled:opacity-50 disabled:cursor-not-allowed"
            style={{backgroundColor: ColorUtil.rgbToHex(ColorUtil.paletteIndexToRGB(paletteName, currValue))}}
            disabled={disabled}
            onClick={() => setPaletteOpen(prev => !prev)}
        />
        {paletteOpen &&
            // Positioning frame only; pointer-events-none so the canvas still receives drags.
            <div className="fixed inset-0 z-50 pointer-events-none">
                {/* The palette stays hidden until measured, so that it never flashes at an unanchored spot. */}
                <div ref={onPaletteRefChange}
                    className={`absolute p-2 flex flex-col gap-0.5 bg-gray-700 rounded-lg overflow-y-auto pointer-events-auto yj-surface-convex ${(paletteStyle == undefined) ? "invisible" : ""}`}
                    style={paletteStyle}>
                    {Array.from({length: Math.ceil(paletteSize / paletteColumns)}, (_, rowIndex) =>
                        <div key={"palette-row-" + rowIndex} className="flex flex-row gap-0.5">
                            {Array.from({length: paletteColumns}, (_, columnIndex) =>
                                rowIndex * paletteColumns + columnIndex)
                                .filter(index => index < paletteSize)
                                .map(index => renderSwatch(index))}
                        </div>)}
                </div>
            </div>}
    </>;
}

interface Props
{
    paletteName: ColorPaletteName; // which set of colors to offer (see ColorPaletteMap)
    currValue: number; // Position in that palette
    setColorIndex: (index: number) => void;
    disabled?: boolean;
}
