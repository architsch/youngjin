import { CSSProperties, useEffect } from "react";

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

    return <button style={style} onClick={() => sendMessage(textInput)}>
        Send
    </button>;
}

const style: CSSProperties = {
    pointerEvents: "all",
    position: "absolute",
    margin: "0.25rem 0.25rem",
    padding: "0.25rem 0.25rem",
    left: "80%",
    right: "0%",
    bottom: "0",
    height: "2.25rem",
    fontSize: "1rem",
    lineHeight: "1.5rem",
    backgroundColor: "green",
    color: "white",
};