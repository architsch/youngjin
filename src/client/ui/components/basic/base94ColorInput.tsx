import { useEffect, useState } from "react";
import ColorUtil from "../../../../shared/math/util/colorUtil";
import { numActiveInputElementsObservable } from "../../../system/clientObservables";

// These must mirror the composition of ColorUtil's base-94 palette
// (grayscale entries first, then the chromatic entries in hue-major order).
const NUM_GRAYSCALE_LEVELS = 10;
const NUM_HUES = 12;
const NUM_VARIANTS_PER_HUE = 7;

export default function Base94ColorInput({ currValue, setColorIndex }: Props)
{
    const [paletteOpen, setPaletteOpen] = useState(false);

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

    const renderSwatch = (index: number) => {
        return <button
            key={"swatch-" + index}
            className={`w-6 h-6 shrink-0 rounded-md cursor-pointer border-2 ${(index == currValue) ? "border-white" : "border-gray-600"}`}
            style={{backgroundColor: ColorUtil.rgbToHex(ColorUtil.base94IndexToRGB(index))}}
            onClick={() => {
                setColorIndex(index);
                setPaletteOpen(false);
            }}
        />;
    };

    return <>
        <button
            className="w-8 h-8 p-0 shrink-0 border-2 border-gray-400 rounded-md cursor-pointer"
            style={{backgroundColor: ColorUtil.rgbToHex(ColorUtil.base94IndexToRGB(currValue))}}
            onClick={() => setPaletteOpen(prev => !prev)}
        />
        {paletteOpen &&
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center">
                <div className="absolute inset-0" onClick={() => setPaletteOpen(false)}/>
                <div className="relative p-2 flex flex-col gap-1 bg-gray-700/90 rounded-lg max-h-[80vh] overflow-y-auto">
                    <div className="flex flex-row gap-1">
                        {Array.from({length: NUM_GRAYSCALE_LEVELS}, (_, grayscaleLevel) =>
                            renderSwatch(grayscaleLevel))}
                    </div>
                    {Array.from({length: NUM_VARIANTS_PER_HUE}, (_, variantIndex) =>
                        <div key={"variant-row-" + variantIndex} className="flex flex-row gap-1">
                            {Array.from({length: NUM_HUES}, (_, hueIndex) =>
                                renderSwatch(NUM_GRAYSCALE_LEVELS + hueIndex * NUM_VARIANTS_PER_HUE + variantIndex))}
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
