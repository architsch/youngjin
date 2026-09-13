import { useEffect } from "react";
import Button from "../../input/button";

let cachedTextInput = "";

export default function ChatSendButton({textInput, sendMessage}
    : {textInput: string, sendMessage: (str: string) => void})
{
    cachedTextInput = textInput;

    const keyResponse = (ev: KeyboardEvent) => {
        // Ignore Enter during IME composition.
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

    // Standard button; on narrow screens the text field (min-w-0) shrinks instead of the button.
    return <Button
        id="chatSendButton"
        name="Send"
        color="green"
        onClick={() => sendMessage(textInput)}
        additionalClassNames="flex-1 m-1"
    />;
}