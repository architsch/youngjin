import { useMemo } from "react";
import ColorUtil from "../../../../shared/math/util/colorUtil";
import { ColorPaletteName } from "../../../../shared/math/maps/colorPaletteMap";
import ThumbnailPanel from "./thumbnailPanel";

// Picks one of a palette's colors from their swatches (see ThumbnailPanel, ColorPaletteMap).
export default function ColorPaletteThumbnailPanel({ id, paletteName, currentColorIndex, canChoose, onChoose }: Props)
{
    // The same list for the same palette, as a new list of choices scrolls the row back to the current color (see
    // ThumbnailPanel).
    const colorIndices = useMemo(
        () => Array.from({length: ColorUtil.getPaletteSize(paletteName)}, (_, colorIndex) => colorIndex),
        [paletteName]);

    return <ThumbnailPanel
        id={id}
        choices={colorIndices}
        current={currentColorIndex}
        canChoose={canChoose}
        onChoose={onChoose}
        // Edged, so a swatch as dark as the panel still shows where it ends.
        renderThumbnail={colorIndex => <div className="size-full rounded-md border border-black/40"
            style={{backgroundColor: ColorUtil.rgbToHex(ColorUtil.paletteIndexToRGB(paletteName, colorIndex))}}/>}
        thumbnailClassNames="w-12 h-18"
    />;
}

interface Props
{
    // Lets automation address the panel, and each swatch by its position in the palette (e.g. "lampColorOptions.0").
    // Panels choosing the same thing share one.
    id: string;
    paletteName: ColorPaletteName; // which set of colors to offer (see ColorPaletteMap)
    currentColorIndex: number; // Position in that palette
    // Absent means every one may be picked.
    canChoose?: (colorIndex: number) => boolean;
    onChoose: (colorIndex: number) => void;
}
