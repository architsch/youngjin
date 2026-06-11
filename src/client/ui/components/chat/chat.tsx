import { useEffect, useState } from "react";
import ChatTextInput from "./chatTextInput";
import ChatSendButton from "./chatSendButton";
import ChatSentMessage from "./chatSentMessage";
import ClientObjectManager from "../../../object/clientObjectManager";
import SpeechBubble from "../../../object/components/speechBubble";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import { clientFeatureFlagsObservable, roomChangedObservable } from "../../../system/clientObservables";
import App from "../../../app";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import AsyncUtil from "../../../../shared/system/util/asyncUtil";
import { FeatureFlag } from "../../../../shared/system/types/featureFlag";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import GameObject from "../../../object/types/gameObject";

export default function Chat({hide}: Props)
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
        if (clientFeatureFlagsObservable.has(FeatureFlag.DisableChatSend))
            return;

        const message = str.trim();
        if (message.length == 0)
            return;

        const player = ClientObjectManager.getMyPlayer();
        if (!player)
        {
            console.error(`MyPlayer not found`);
            return;
        }

        setMyPlayerSentMessage(player, message);
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

        setMyPlayerSentMessage(player, "");
        setState({textInput: state.textInput, sentMessage: ""});
    };

    if (hide)
    {
        return null;
    }
    else
    {
        return <>
            <div className="flex flex-row flex-wrap gap-x-1 gap-y-0 p-2 w-full">
                <ChatTextInput textInput={state.textInput} setTextInput={setTextInput}/>
                <ChatSendButton textInput={state.textInput} sendMessage={sendMessage}/>
            </div>
            {state.sentMessage.length > 0 && <ChatSentMessage
                sentMessage={state.sentMessage}
                clearSentMessage={clearSentMessage}
            />}
        </>;
    }
}

// Applies the player's SentMessage (an empty string clears it).
// In multiplayer the server is authoritative: the message is broadcast and echoed back, which
// is what persists the SentMessage metadata on the player. Single-player has no such round-trip,
// so persist the metadata locally instead — this both drives the speech bubble (via the object's
// onSetMetadata hook) and makes the SentMessage readable by single-player step conditions.
function setMyPlayerSentMessage(player: GameObject, message: string)
{
    const room = App.getCurrentRoom();
    if (room && room.roomType == RoomTypeEnumMap.SinglePlayer)
        ClientObjectManager.setObjectMetadata(player.params.objectId,
            ObjectMetadataKeyEnumMap.SentMessage, message, false);
    else
        (player.components.speechBubble as SpeechBubble).setMessage(message, true);
}

interface ChatState
{
    textInput: string;
    sentMessage: string;
}

interface Props
{
    hide: boolean;
}