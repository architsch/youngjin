import PaletteColorInput from "./paletteColorInput";
import Text from "../basic/text";
import { ColorPaletteName } from "../../../../shared/math/maps/colorPaletteMap";

export default function FormPaletteColorInput({ label, paletteName, currValue, setColorIndex }: Props)
{
    // The swatch stands level with its label, which is the taller of the two.
    return <div className="flex flex-row items-center gap-1">
        <Text content={label} size="sm" />
        <PaletteColorInput
            paletteName={paletteName}
            currValue={currValue}
            setColorIndex={setColorIndex}
        />
    </div>
}

interface Props
{
    label: string;
    paletteName: ColorPaletteName; // which set of colors to offer (see ColorPaletteMap)
    currValue: number; // Position in that palette
    setColorIndex: (index: number) => void;
}
