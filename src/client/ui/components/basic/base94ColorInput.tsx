import { CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import ColorUtil from "../../../../shared/math/util/colorUtil";
import NumUtil from "../../../../shared/math/util/numUtil";
import { numActiveInputElementsObservable } from "../../../system/clientObservables";

const PALETTE_GAP = 4; // Space kept between the button and the palette above it
const SCREEN_MARGIN = 8; // Space kept between the palette and the screen edges

export default function Base94ColorInput({ currValue, setColorIndex }: Props)
{
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [paletteStyle, setPaletteStyle] = useState<CSSProperties | undefined>(undefined);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const paletteRef = useRef<HTMLDivElement>(null);

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
        window.addEventListener("keydown", onKeyDown);
        return () => {
            numActiveInputElementsObservable.change(n => n - 1);
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [paletteOpen]);

    useLayoutEffect(() => {
        const button = buttonRef.current;
        const palette = paletteRef.current;
        if (!paletteOpen || button == null || palette == null)
        {
            setPaletteStyle(undefined);
            return;
        }
        // Anchor the palette right above the button, pushing it back inside the
        // screen (and capping its height) so that no part of it gets cut off.
        const reposition = () => {
            const buttonRect = button.getBoundingClientRect();
            const paletteWidth = palette.offsetWidth;
            setPaletteStyle({
                left: NumUtil.clampInRange(buttonRect.left + 0.5 * (buttonRect.width - paletteWidth),
                    SCREEN_MARGIN, Math.max(SCREEN_MARGIN, window.innerWidth - paletteWidth - SCREEN_MARGIN)),
                bottom: window.innerHeight - buttonRect.top + PALETTE_GAP,
                maxHeight: Math.max(0, buttonRect.top - PALETTE_GAP - SCREEN_MARGIN),
            });
        };
        reposition();
        // Re-measure whenever the palette's own size changes (e.g. once the height
        // cap above brings in a scrollbar), or whenever the button moves.
        const paletteResizeObserver = new ResizeObserver(reposition);
        paletteResizeObserver.observe(palette);
        window.addEventListener("resize", reposition);
        window.addEventListener("scroll", reposition, true); // Capturing, so that scrolling ancestors count too
        return () => {
            paletteResizeObserver.disconnect();
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
            <div className="fixed inset-0 z-50">
                <div className="absolute inset-0" onClick={() => setPaletteOpen(false)}/>
                {/* The palette stays hidden until measured, so that it never flashes at an unanchored spot. */}
                <div ref={paletteRef}
                    className={`absolute p-2 flex flex-col gap-0.5 bg-gray-700 rounded-lg overflow-y-auto ${(paletteStyle == undefined) ? "invisible" : ""}`}
                    style={paletteStyle}>
                    {Array.from({length: Math.ceil(ColorUtil.base94PaletteSize / ColorUtil.base94PaletteColumns)}, (_, rowIndex) =>
                        <div key={"palette-row-" + rowIndex} className="flex flex-row gap-0.5">
                            {Array.from({length: ColorUtil.base94PaletteColumns}, (_, columnIndex) =>
                                rowIndex * ColorUtil.base94PaletteColumns + columnIndex)
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
