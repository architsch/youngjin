import PaletteColorInput from "./paletteColorInput";
import Text from "../basic/text";
import { ColorPaletteName } from "../../../../shared/math/maps/colorPaletteMap";

export default function FormPaletteColorInput({ label, paletteName, currValue, setColorIndex }: Props)
{
    return <div className="flex flex-row gap-1">
        <Text content={label}/>
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
