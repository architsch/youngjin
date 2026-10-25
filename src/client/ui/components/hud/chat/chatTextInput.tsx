import { ClipboardEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useRef } from "react";
import { chatTextInputObservable, numActiveInputElementsObservable } from "../../../../system/clientObservables";
import { OBJECT_MESSAGE_MAX_LENGTH } from "../../../../../shared/system/sharedConstants";
import ChatInputEditUtil from "../../../util/chatInputEditUtil";

// Pasted text and drops come as plain text where a browser can keep them so; elsewhere, pastes are taken as text here,
// and drops refused.
const EDITABLE = getPlainTextEditing() ? "plaintext-only" : "true";

// A line to type in, in which a web address becomes a chip once written out (see ChatInputEditUtil), and the message
// it holds carries as a link (see MessageLinkUtil). Its content is the browser's own while typing, so that IME (CJK)
// composition goes undisturbed: it is read as typed, and drawn anew only when changed from outside (e.g. cleared once
// sent). Pictured in messages by a hand-made copy (see ScreenControlPicture): a new look goes there too.
export default function ChatTextInput({textInput, setTextInput}
    : {textInput: string, setTextInput: (newTextInput: string) => void})
{
    const editorRef = useRef<HTMLDivElement>(null);
    // The message the editor was last drawn or read as.
    const shownRef = useRef<string | undefined>(undefined);
    // Whether a paste is being taken, whose addresses are complete however they end.
    const pastingRef = useRef(false);

    useEffect(() => {
        const editor = editorRef.current;
        if (editor && textInput !== shownRef.current)
        {
            ChatInputEditUtil.show(editor, textInput);
            shownRef.current = textInput;
        }
    }, [textInput]);

    const commit = () => {
        const editor = editorRef.current;
        if (!editor)
            return;
        ChatInputEditUtil.linkAddresses(editor, pastingRef.current);
        pastingRef.current = false;
        ChatInputEditUtil.limit(editor, OBJECT_MESSAGE_MAX_LENGTH);
        const message = ChatInputEditUtil.read(editor);
        // Emptied, it holds nothing at all, which shows the placeholder.
        if (message.trim().length == 0 && editor.textContent == "")
            editor.replaceChildren();
        shownRef.current = message;
        setTextInput(message);
        chatTextInputObservable.set(message);
    };

    const onInput = (event: FormEvent<HTMLDivElement>) => {
        if (!(event.nativeEvent as InputEvent).isComposing)
            commit();
    };

    // Enter sends (see ChatSendButton) rather than breaking the line. A chip goes whole.
    const onKeyDownHere = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.nativeEvent.isComposing)
            return;
        if (event.key == "Enter")
            event.preventDefault();
        else if ((event.key == "Backspace" || event.key == "Delete") && editorRef.current
            && ChatInputEditUtil.removeChipAt(editorRef.current, event.key == "Backspace"))
        {
            event.preventDefault();
            commit();
        }
    };

    const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (!editorRef.current)
            return;
        pastingRef.current = true;
        ChatInputEditUtil.insertText(editorRef.current, event.clipboardData.getData("text/plain").replace(/\s+/g, " "));
        commit();
    };

    const onKeyDown = (ev: KeyboardEvent) =>
    {
        if ((ev.key == "Enter" || ev.key == "Escape") && !ev.isComposing && editorRef.current)
            editorRef.current.blur();
    };

    useEffect(() => {
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, []);

    // min-w-0 removes the default intrinsic width, so the field (not the Send button) shrinks on phones. It is one line,
    // scrolled to the caret, and selectable inside #uiRoot's select-none layer.
    return <div
        id="chatTextInput"
        ref={editorRef}
        contentEditable={EDITABLE}
        role="textbox"
        aria-label="Your Message"
        data-placeholder="Your Message"
        enterKeyHint="send"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        className="flex-4 min-w-0 m-1 px-2 h-10 leading-10 text-left whitespace-nowrap overflow-hidden rounded-md text-base text-gray-900 bg-gray-200 outline-none cursor-text select-text pointer-events-auto yj-surface-concave empty:before:content-[attr(data-placeholder)] empty:before:text-gray-500"
        onInput={onInput}
        onCompositionEnd={commit}
        onKeyDown={onKeyDownHere}
        onPaste={onPaste}
        onDrop={EDITABLE == "true" ? (event) => event.preventDefault() : undefined}
        onFocus={onFocus}
        onBlur={onBlur}
    />;
}

function getPlainTextEditing(): boolean
{
    try
    {
        const probe = document.createElement("div");
        probe.contentEditable = "plaintext-only";
        return probe.contentEditable == "plaintext-only";
    }
    catch
    {
        return false;
    }
}

function onFocus()
{
    numActiveInputElementsObservable.change(n => n + 1);
}

function onBlur()
{
    numActiveInputElementsObservable.change(n => n - 1);
}
