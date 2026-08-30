import { useState } from "react";
import Text from "../basic/text";
import FormTextInput from "../input/formTextInput";
import PaletteColorInput from "../input/paletteColorInput";
import Form from "./form";
import ObjectLabelProps from "../../types/objectLabelProps";
import { LABEL_COLOR_PALETTE_NAME } from "../../../../shared/system/sharedConstants";

// What an object says, and what it says it in.
//
// Deliberately about no particular kind of object: the text written on something and the color it is
// written in are one pair of metadata entries that any object carrying a LabelText component has, so
// a door is only the first thing to be named through this form.
//
// Both controls take effect as they are used, with nothing to confirm. The object is in view behind
// the form, so what a name looks like on it is answer enough — and a confirming button beside the
// field is the first thing a narrow screen pushes off its edge.
export default function CustomizeObjectLabelForm({ initialText, initialColorIndex,
    onSetText, onSetColorIndex }: ObjectLabelProps)
{
    const [text, setText] = useState<string>(initialText);
    const [colorIndex, setColorIndex] = useState<number>(initialColorIndex);

    return <Form>
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
