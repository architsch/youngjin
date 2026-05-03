import { useEffect, useState } from "react";
import ChatTextInput from "./chatTextInput";
import ChatSendButton from "./chatSendButton";
import ChatSentMessage from "./chatSentMessage";
import ClientObjectManager from "../../../object/clientObjectManager";
import SpeechBubble from "../../../object/components/speechBubble";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import { roomChangedObservable } from "../../../system/clientObservables";
import App from "../../../app";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import AsyncUtil from "../../../../shared/system/util/asyncUtil";

export default function Chat({selectionIsActive}: Props)
{
    const [state, setState] = useState<ChatState>({textInput: "", sentMessage: ""});

    useEffect(() => {
        roomChangedObservable.addListener("ui_chat", async (roomRuntimeMemory: RoomRuntimeMemory) => {
            const user = App.getUser();
            if (!user)
                return;
            await AsyncUtil.waitUntilSuccess(
                () => ClientObjectManager.getMyPlayer() != undefined, 5000);

            const myPlayer = ClientObjectManager.getMyPlayer();
            if (!myPlayer)
            {
                console.error("Player GameObject not found.");
                return;
            }
            const playerObj = myPlayer ? roomRuntimeMemory.room.objectById[myPlayer.params.objectId] : undefined;
            if (!playerObj)
            {
                console.error("Player AddObjectSignal not found.");
                return;
            }
            const metadata = playerObj.metadata[ObjectMetadataKeyEnumMap.SentMessage];
            const metadataValue = metadata ? metadata.str : "";
            setState(prev => ({...prev, sentMessage: metadataValue}));

        });
        return () => { roomChangedObservable.removeListener("ui_chat"); };
    }, []);

    const setTextInput = (textInput: string) => {
        setState({textInput, sentMessage: state.sentMessage});
    };

    const sendMessage = (str: string) => {
        const message = str.trim();
        if (message.length == 0)
            return;

        const player = ClientObjectManager.getMyPlayer();
        if (!player)
        {
            console.error(`MyPlayer not found`);
            return;
        }

        const speechBubble = player.components.speechBubble as SpeechBubble;
        speechBubble.setMessage(message, true);
        setState({textInput: "", sentMessage: message});
    };

    const clearSentMessage = () => {
        if (state.sentMessage.length == 0)
        {
            console.error(`No sent message to clear`);
            return;
        }
        const player = ClientObjectManager.getMyPlayer();
        if (!player)
        {
            console.error(`MyPlayer not found`);
            return;
        }

        const speechBubble = player.components.speechBubble as SpeechBubble;
        speechBubble.setMessage("", true);
        setState({textInput: state.textInput, sentMessage: ""});
    };

    if (selectionIsActive)
    {
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
    else
    {
        return null;
    }
}

const className = "flex flex-row flex-wrap gap-x-1 gap-y-0 p-2 w-full";

interface ChatState
{
    textInput: string;
    sentMessage: string;
}

interface Props
{
    selectionIsActive: boolean;
}