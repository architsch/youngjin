import { useState } from "react";
import TextInput from "../../input/textInput";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import ObjectEditUtil from "../../../util/objectEditUtil";
import StringUtil from "../../../../../shared/math/util/stringUtil";
import { ObjectMetadataKey } from "../../../../../shared/object/types/objectMetadataKey";

// A one-line field holding one of the selected object's metadata values (its name, its tags), saved as it is
// typed. Whoever shows it keys it by the object, so it starts afresh on each.
export default function ObjectMetadataTextInput({ selection, metadataKey, maxLength, filterText = (text => text), id,
    placeholder, additionalClassNames = "" }: Props)
{
    // Read off the object each render, as every edit of it re-announces the selection (see ClientObjectManager).
    const storedText = selection.gameObject.params.metadata[metadataKey]?.str ?? "";

    // The field's own text is held beside the stored one it was last in step with, rather than read back: the stored
    // text is tidied (see ObjectMetadataEntryMap), and a space or comma typed at the end has to stay in the field.
    // Once the stored text changes from under the field, the field follows it.
    const [field, setField] = useState({text: storedText, storedText});
    if (field.storedText != storedText)
        setField({text: storedText, storedText});

    return <TextInput
        id={id}
        size="sm"
        placeholder={placeholder}
        currValue={field.text}
        filterTextInput={(rawText: string) => StringUtil.truncateByCodePoints(filterText(rawText), maxLength)}
        setTextInput={(newText: string) => {
            ObjectEditUtil.trySetObjectMetadata(selection, metadataKey, newText);
            setField({text: newText, storedText: selection.gameObject.params.metadata[metadataKey]?.str ?? ""});
        }}
        additionalClassNames={`shrink-0 ${additionalClassNames}`}
    />;
}

interface Props
{
    selection: ObjectSelection;
    metadataKey: ObjectMetadataKey;
    maxLength: number; // in code points
    // Takes out of what is typed whatever the value can't hold.
    filterText?: (text: string) => string;
    // Lets automation address the field.
    id?: string;
    placeholder?: string;
    additionalClassNames?: string;
}
