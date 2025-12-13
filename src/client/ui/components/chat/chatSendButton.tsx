import { useEffect } from "react";

let cachedTextInput = "";

export default function ChatSendButton({textInput, sendMessage}
    : {textInput: string, sendMessage: (str: string) => void})
{
    cachedTextInput = textInput;

    const keyResponse = (ev: KeyboardEvent) => {
        if (ev.key == "Enter" && cachedTextInput.trim().length > 0)
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

    return <button
        className="flex-1 m-1 px-2 py-1 justify-self-end text-center align-middle border-2 border-green-900 text-base text-gray-100 bg-green-700 pointer-events-auto"
        onClick={() => sendMessage(textInput)}>
            Send
    </button>;
}