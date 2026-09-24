import { useState } from "react";
import Text from "../basic/text";
import TextInput from "../input/textInput";
import PaletteColorInput from "../input/paletteColorInput";
import Checkbox from "../input/checkbox";
import StepperInput from "../input/stepperInput";
import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";
import ObjectEditUtil from "../../util/objectEditUtil";
import LabelTextUtil from "../../../../shared/object/util/labelTextUtil";
import StringUtil from "../../../../shared/math/util/stringUtil";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import { LABEL_COLOR_PALETTE_NAME, OBJECT_LABEL_MAX_LENGTH } from "../../../../shared/system/sharedConstants";
import ScrollPanel from "./scrollPanel";

const FONT_SIZE_LABELS = LabelTextUtil.fontSizes.map(String);

// Edits the lettering of any object with LabelText (a door's plate, a label): its text, color and size.
// Each change is saved as it is made.
export default function CustomizeLabelTextPanel({ selection, onClose }: Props)
{
    // Held here rather than read back, since the stored text is trimmed (see ObjectMetadataEntryMap) and a
    // space or line break typed at the end has to stay in the field.
    const [text, setText] = useState(() => LabelTextUtil.getText(selection.gameObject.params));
    const [colorIndex, setColorIndex] = useState(() => LabelTextUtil.getColorIndex(selection.gameObject.params));
    const [font, setFont] = useState(() => LabelTextUtil.getFont(selection.gameObject.params));

    const applyFont = (autoSize: boolean, fontSize: number) => {
        setFont({autoSize, fontSize});
        ObjectEditUtil.trySetObjectMetadata(selection, ObjectMetadataKeyEnumMap.LabelFont,
            LabelTextUtil.encodeFont(autoSize, fontSize));
    };

    return <ScrollPanel id="customizeLabelTextOptions" onClose={onClose} additionalClassNames="m-2">
        <TextInput
            id="labelTextInput"
            size="sm"
            placeholder="Label text"
            currValue={text}
            filterTextInput={(rawText: string) =>
                StringUtil.truncateByCodePoints(rawText, OBJECT_LABEL_MAX_LENGTH)}
            setTextInput={(newText: string) => {
                setText(newText);
                ObjectEditUtil.trySetObjectMetadata(selection, ObjectMetadataKeyEnumMap.Label, newText);
            }}
            maxVisibleLines={4}
            additionalClassNames="w-56 shrink-0 self-center"
        />
        <div className="w-px self-stretch shrink-0 bg-gray-500"/>
        <div className="flex flex-row items-center gap-1 shrink-0">
            <Text content="Color" size="sm"/>
            <PaletteColorInput
                paletteName={LABEL_COLOR_PALETTE_NAME}
                currValue={colorIndex}
                setColorIndex={(index: number) => {
                    setColorIndex(index);
                    ObjectEditUtil.trySetObjectMetadata(selection, ObjectMetadataKeyEnumMap.LabelColor, `${index}`);
                }}
            />
        </div>
        <div className="w-px self-stretch shrink-0 bg-gray-500"/>
        <Checkbox label="Auto Size" size="sm" checked={font.autoSize}
            onChange={(checked: boolean) => applyFont(checked, font.fontSize)} additionalClassNames="shrink-0"/>
        <div className="w-px self-stretch shrink-0 bg-gray-500"/>
        <div className="flex flex-col items-center gap-1 shrink-0">
            <Text content="Font Size" size="sm"/>
            <StepperInput
                currValue={LabelTextUtil.fontSizes.indexOf(font.fontSize)}
                numValues={LabelTextUtil.fontSizes.length}
                setValue={(index: number) => applyFont(font.autoSize, LabelTextUtil.fontSizes[index])}
                labels={FONT_SIZE_LABELS}
                disabled={font.autoSize}
            />
        </div>
    </ScrollPanel>;
}

interface Props
{
    selection: ObjectSelection;
    onClose: () => void;
}
