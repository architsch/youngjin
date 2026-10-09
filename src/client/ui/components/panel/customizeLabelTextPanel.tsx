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
    // Read off the object each render, as every edit of it re-announces the selection (see ClientObjectManager): its
    // own, one undone, or somebody else's.
    const params = selection.gameObject.params;
    const storedText = LabelTextUtil.getText(params);
    const colorIndex = LabelTextUtil.getColorIndex(params);
    const font = LabelTextUtil.getFont(params);

    // The field's own text is held beside the stored one it was last in step with, rather than read back: the stored
    // text is trimmed (see ObjectMetadataEntryMap), and a space or line break typed at the end has to stay in the
    // field. Once the stored text changes from under the field, the field follows it.
    const [field, setField] = useState({text: storedText, storedText});
    if (field.storedText != storedText)
        setField({text: storedText, storedText});

    const applyFont = (autoSize: boolean, fontSize: number) => {
        ObjectEditUtil.trySetObjectMetadata(selection, ObjectMetadataKeyEnumMap.LabelFont,
            LabelTextUtil.encodeFont(autoSize, fontSize));
    };

    return <ScrollPanel id="customizeLabelTextOptions" onClose={onClose}>
        <TextInput
            id="labelTextInput"
            size="sm"
            placeholder="Label text"
            currValue={field.text}
            filterTextInput={(rawText: string) =>
                StringUtil.truncateByCodePoints(rawText, OBJECT_LABEL_MAX_LENGTH)}
            setTextInput={(newText: string) => {
                ObjectEditUtil.trySetObjectMetadata(selection, ObjectMetadataKeyEnumMap.Label, newText);
                setField({text: newText, storedText: LabelTextUtil.getText(selection.gameObject.params)});
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
                setColorIndex={(index: number) =>
                    ObjectEditUtil.trySetObjectMetadata(selection, ObjectMetadataKeyEnumMap.LabelColor, `${index}`)}
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
    // Absent means it has no close button (see ScrollPanel).
    onClose?: () => void;
}
