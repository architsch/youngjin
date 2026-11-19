import { useEffect, useRef } from "react";
import { numActiveInputElementsObservable } from "../../../system/clientObservables";

// A name typed in the place of the thing it names (see ImageCategoryTree), in that thing's own text size. It holds the
// keyboard from the start, with the name it had selected. Enter, or leaving the field, takes the name; Escape, or a
// name left empty or as it was, takes none. A name the owner refuses leaves the field up, with the keyboard again.
export default function NameInput({ id, name, placeholder = "", onConfirm, onCancel, additionalClassNames = "" }: Props)
{
    const inputRef = useRef<HTMLInputElement>(null);
    const cancelledRef = useRef(false);

    // Whether this field currently counts toward active inputs.
    const isFocused = useRef<boolean>(false);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
        // Released on unmount while focused (see TextInput).
        return () => {
            if (isFocused.current)
                numActiveInputElementsObservable.change(n => n - 1);
        };
    }, []);

    return <input
        ref={inputRef}
        id={id}
        type="text"
        className={`px-1 text-left yj-panel-white yj-surface-concave ${additionalClassNames}`}
        placeholder={placeholder}
        defaultValue={name}
        onFocus={() => {
            isFocused.current = true;
            numActiveInputElementsObservable.change(n => n + 1);
        }}
        onBlur={event => {
            isFocused.current = false;
            numActiveInputElementsObservable.change(n => n - 1);
            const typed = event.currentTarget.value.trim();
            if (cancelledRef.current || typed.length == 0 || typed == name)
                onCancel();
            else if (!onConfirm(typed))
                window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
        onKeyDown={event => {
            if (event.key == "Enter" && !event.nativeEvent.isComposing)
                event.currentTarget.blur();
            if (event.key != "Escape")
                return;
            cancelledRef.current = true;
            // Kept from the browser, whose own close request would go on to close what the field is in (see
            // useCloseGesture).
            event.preventDefault();
            event.currentTarget.blur();
        }}
    >
    </input>;
}

interface Props
{
    // Lets automation address the field.
    id?: string;
    // What the field starts with: the name being changed, or nothing for a new one.
    name: string;
    placeholder?: string;
    // The name as typed, trimmed. False refuses it.
    onConfirm: (name: string) => boolean;
    onCancel: () => void;
    additionalClassNames?: string;
}
