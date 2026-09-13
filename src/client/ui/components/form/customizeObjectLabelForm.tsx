import { useState } from "react";
import Text from "../basic/text";
import FormTextInput from "../input/formTextInput";
import PaletteColorInput from "../input/paletteColorInput";
import Form from "./form";
import ObjectLabelProps from "../../types/objectLabelProps";
import { LABEL_COLOR_PALETTE_NAME } from "../../../../shared/system/sharedConstants";

// Edits an object's label text and color (any object with LabelText). Changes apply immediately with
// no confirm button, since the object is visible behind the form.
export default function CustomizeObjectLabelForm({ initialText, initialColorIndex,
    onSetText, onSetColorIndex }: ObjectLabelProps)
{
    const [text, setText] = useState<string>(initialText);
    const [colorIndex, setColorIndex] = useState<number>(initialColorIndex);

    return <Form id="objectLabelForm">
        <FormTextInput
            label="Label Text:"
            size="sm"
            currValue={text}
            setTextInput={(newText: string) => {
                setText(newText);
                onSetText(newText);
            }}
        />
        <div className="flex flex-row items-center gap-1">
            <Text content="Label Color:" size="sm"/>
            <PaletteColorInput
                paletteName={LABEL_COLOR_PALETTE_NAME}
                currValue={colorIndex}
                setColorIndex={(index: number) => {
                    setColorIndex(index);
                    onSetColorIndex(index);
                }}
            />
        </div>
    </Form>;
}
