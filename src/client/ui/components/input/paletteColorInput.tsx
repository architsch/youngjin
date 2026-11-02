import ColorUtil from "../../../../shared/math/util/colorUtil";
import { ColorPaletteName } from "../../../../shared/math/maps/colorPaletteMap";
import ToggledGridInput from "./toggledGridInput";

// Palette columns: wider on landscape screens; narrow and scrolling on portrait, to keep the preview
// visible.
const PALETTE_COLUMNS_ON_HORIZONTAL_SCREEN = 4;
const PALETTE_COLUMNS_ON_VERTICAL_SCREEN = 2;

// Palette contents depend on what is painted (see ColorPaletteMap).
export default function PaletteColorInput({ paletteName, currValue, setColorIndex, disabled = false }: Props)
{
    const renderSwatch = (index: number, close: () => void) => {
        // Selected: white border with a dark inner ring, readable on any swatch color.
        return <button
            key={"swatch-" + index}
            className={`w-10 h-10 shrink-0 rounded-md cursor-pointer select-none touch-manipulation border-2 ${(index == currValue) ? "border-white shadow-[inset_0_0_0_2px_#000000]" : "border-gray-600"}`}
            style={{backgroundColor: ColorUtil.rgbToHex(ColorUtil.paletteIndexToRGB(paletteName, index))}}
            onClick={() => {
                setColorIndex(index);
                close();
            }}
        />;
    };

    return <ToggledGridInput
        numCells={ColorUtil.getPaletteSize(paletteName)}
        columnsOnHorizontalScreen={PALETTE_COLUMNS_ON_HORIZONTAL_SCREEN}
        columnsOnVerticalScreen={PALETTE_COLUMNS_ON_VERTICAL_SCREEN}
        renderCell={renderSwatch}
        buttonClassNames="w-8 h-6 p-0 shrink-0 rounded-md cursor-pointer select-none touch-manipulation yj-surface-concave disabled:opacity-50 disabled:cursor-not-allowed"
        buttonStyle={{backgroundColor: ColorUtil.rgbToHex(ColorUtil.paletteIndexToRGB(paletteName, currValue))}}
        disabled={disabled}
    />;
}

interface Props
{
    paletteName: ColorPaletteName; // which set of colors to offer (see ColorPaletteMap)
    currValue: number; // Position in that palette
    setColorIndex: (index: number) => void;
    disabled?: boolean;
}
