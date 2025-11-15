import { useEffect, useState } from "react";
import ChatTextInput from "./chatTextInput";
import ChatSendButton from "./chatSendButton";
import ChatSentMessage from "./chatSentMessage";
import ObjectManager from "../../../object/objectManager";
import App from "../../../app";
import ObjectMessageParams from "../../../../shared/object/types/objectMessageParams";
import GameSocketsClient from "../../../networking/gameSocketsClient";

let sentMessageTimeout: NodeJS.Timeout | undefined = undefined;

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
            console.error(`Player not found (userName = ${App.getEnv().user.userName})`);
            return;
        }
        const params = new ObjectMessageParams(
            player.params.objectId,
            message
        );
        GameSocketsClient.emitObjectMessage(params);
        setState({textInput: "", sentMessage: message});

    };

    useEffect(() => {
        if (sentMessageTimeout != undefined)
            clearTimeout(sentMessageTimeout);
        if (state.sentMessage.length > 0)
        {
            sentMessageTimeout = setTimeout(() => {
                setState({textInput: state.textInput, sentMessage: ""});
            }, 5000);
        }

        return () => {
            if (sentMessageTimeout != undefined)
                clearTimeout(sentMessageTimeout);
        }
    }, [state.sentMessage]);

    return <>
        <ChatTextInput textInput={state.textInput} setTextInput={setTextInput}/>
        <ChatSendButton textInput={state.textInput} sendMessage={sendMessage}/>
        {state.sentMessage.length > 0 && <ChatSentMessage sentMessage={state.sentMessage}/>}
    </>;
}

interface ChatState
{
    textInput: string;
    sentMessage: string;
}