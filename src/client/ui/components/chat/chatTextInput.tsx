import { FormEvent, FormEventHandler } from "react";

export default function ChatTextInput({textInput, setTextInput}
    : {textInput: string, setTextInput: (newTextInput: string) => void})
{
    const onInput: FormEventHandler<HTMLInputElement> = (event: FormEvent<HTMLInputElement>) => {
        setTextInput(event.currentTarget.value.substring(0, 32));
    };

    return <input
        type="text"
        className="flex-4 m-1 p-1 justify-self-start text-left align-middle border-2 border-gray-700 text-base text-gray-900 bg-gray-200 pointer-events-auto"
        onInput={onInput}
        placeholder="Your Message Here"
        value={textInput}>
    </input>;
}