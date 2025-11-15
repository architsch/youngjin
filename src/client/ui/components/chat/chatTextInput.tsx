import { CSSProperties, FormEvent, FormEventHandler } from "react";

export default function ChatTextInput({textInput, setTextInput}
    : {textInput: string, setTextInput: (newTextInput: string) => void})
{
    const onInput: FormEventHandler<HTMLInputElement> = (event: FormEvent<HTMLInputElement>) => {
        setTextInput(event.currentTarget.value.substring(0, 32));
    };

    return <input type="text" style={style} onInput={onInput} placeholder="Your Message Here" value={textInput}>
    </input>;
}

const style: CSSProperties = {
    pointerEvents: "all",
    position: "absolute",
    margin: "0.25rem 0.25rem",
    padding: "0.25rem 0.25rem",
    left: "0",
    right: "20%",
    bottom: "0",
    height: "1.5rem",
    fontSize: "1rem",
    lineHeight: "1.5rem",
};