import { useEffect, useRef, useState } from "react";
import Button from "../input/button";
import TextInput from "../input/textInput";
import ClosablePanelUtil from "../../util/closablePanelUtil";

// Names a category of the chooser under it, for an admin adding one or renaming one (see ImageMapThumbnailPanel): a
// field for its title, typed into at once, and what confirms it, as Enter does too. The owner puts the bar away
// once it takes the title.
export default function ImageCategoryNameBar({ id, title, confirmName, onConfirm, onClose }: Props)
{
    const [text, setText] = useState<string>(title);
    const fieldId = `${id}.title`;

    useEffect(() => {
        document.getElementById(fieldId)?.focus();
    }, []);

    // Closed by a back gesture before the chooser under it is (see ClosablePanelUtil).
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    useEffect(() => {
        const token = ClosablePanelUtil.register(() => onCloseRef.current());
        return () => ClosablePanelUtil.unregister(token);
    }, []);

    return <div id={id} onKeyDown={event => {
            if (event.key == "Enter")
                onConfirm(text);
        }}
        className="p-1.5 flex flex-row flex-wrap items-center gap-1.5 w-fit bg-gray-700 rounded-lg pointer-events-auto yj-surface-convex">
        <TextInput id={fieldId} size="sm" placeholder="Category name" currValue={text} setTextInput={setText}
            additionalClassNames="min-w-32 h-7.5"/>
        <Button id={`${id}.confirm`} name={confirmName} size="sm" color="green" onClick={() => onConfirm(text)}/>
        <Button id={`${id}.cancel`} name="Cancel" size="sm" onClick={onClose}/>
    </div>;
}

interface Props
{
    // Lets automation address the bar, its field (".title") and its two buttons (".confirm", ".cancel").
    id: string;
    // What the field starts with: a renamed category's own title, or nothing.
    title: string;
    confirmName: string;
    // The title as typed, which the owner may refuse, leaving the bar up.
    onConfirm: (title: string) => void;
    onClose: () => void;
}
