import { useState } from "react";
import ChatTextInput from "./chatTextInput";
import ChatSendButton from "./chatSendButton";
import ChatSentMessage from "./chatSentMessage";
import ObjectManager from "../../../object/objectManager";
import SpeechBubble from "../../../object/components/speechBubble";

export default function Chat()
{
    const [state, setState] = useState<ChatState>({textInput: "", sentMessage: ""});

    const setTextInput = (textInput: string) => {
        setState({textInput, sentMessage: state.sentMessage});
    };

    const sendMessage = (str: string) => {
        const message = str.trim();
        if (message.length == 0)
            return;

        const player = ObjectManager.getMyPlayer();
        if (!player)
        {
            console.error(`MyPlayer not found`);
            return;
        }
        
        const speechBubble = player.components.speechBubble as SpeechBubble;
        speechBubble.setMessage(message, false, true);
        setState({textInput: "", sentMessage: message});
    };

    const clearSentMessage = () => {
        if (state.sentMessage.length == 0)
        {
            console.error(`No sent message to clear`);
            return;
        }
        const player = ObjectManager.getMyPlayer();
        if (!player)
        {
            console.error(`MyPlayer not found`);
            return;
        }
        
        const speechBubble = player.components.speechBubble as SpeechBubble;
        speechBubble.setMessage("", false, true);
        setState({textInput: state.textInput, sentMessage: ""});
    };

    return <>
        <div className={className}>
            <ChatTextInput textInput={state.textInput} setTextInput={setTextInput}/>
            <ChatSendButton textInput={state.textInput} sendMessage={sendMessage}/>
        </div>
        {state.sentMessage.length > 0 && <ChatSentMessage
            sentMessage={state.sentMessage}
            clearSentMessage={clearSentMessage}
        />}
    </>;
}

const className = "flex flex-row flex-wrap gap-x-1 gap-y-0 p-2 absolute w-full bottom-0";

interface ChatState
{
    textInput: string;
    sentMessage: string;
}