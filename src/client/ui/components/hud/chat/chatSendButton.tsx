import { useEffect } from "react";
import Button from "../../input/button";

let cachedTextInput = "";

export default function ChatSendButton({textInput, sendMessage}
    : {textInput: string, sendMessage: (str: string) => void})
{
    cachedTextInput = textInput;

    const keyResponse = (ev: KeyboardEvent) => {
        // Skip Enter while IME is composing — otherwise we send a stale value before
        // the IME has committed the in-progress character.
        if (ev.key == "Enter" && !ev.isComposing && cachedTextInput.trim().length > 0)
        {
            ev.preventDefault();
            sendMessage(cachedTextInput);
        }
    };

    useEffect(() => {
        addEventListener("keydown", keyResponse);
        return () => {
            removeEventListener("keydown", keyResponse);
        }
    }, []);

    // Wears the app's standard button look rather than one of its own, so that the one control the
    // user reaches for most often is not the odd one out. It only takes the share of the chat row
    // the text field beside it leaves over.
    return <Button
        id="chatSendButton"
        name="Send"
        color="green"
        onClick={() => sendMessage(textInput)}
        additionalClassNames="flex-1 m-1"
    />;
}