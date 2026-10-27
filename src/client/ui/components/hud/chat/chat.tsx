import { useEffect, useState } from "react";
import ChatTextInput from "./chatTextInput";
import ChatSendButton from "./chatSendButton";
import ChatSentMessage from "./chatSentMessage";
import ClientObjectManager from "../../../../object/clientObjectManager";
import SpeechBubble from "../../../../object/components/speechBubble";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import { clientFeatureFlagsObservable, roomChangedObservable,
    singlePlayerChatLineObservable } from "../../../../system/clientObservables";
import App from "../../../../app";
import RoomRuntimeMemory from "../../../../../shared/room/types/roomRuntimeMemory";
import AsyncUtil from "../../../../../shared/system/util/asyncUtil";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";
import { RoomTypeEnumMap } from "../../../../../shared/room/types/roomType";
import GameObject from "../../../../object/types/gameObject/gameObject";
import HelperThinkingUtil from "../../../../object/util/helperThinkingUtil";
import { PLAYER_MESSAGE_EXPIRATION_MS } from "../../../../../shared/system/sharedConstants";

export default function Chat({hide}: Props)
{
    const [state, setState] = useState<ChatState>({textInput: "", sentMessage: "", sentMessageSince: 0});

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
            setState(prev => ({...prev, sentMessage: metadataValue, sentMessageSince: Date.now()}));
        });
        return () => { roomChangedObservable.removeListener("ui_chat"); };
    }, []);

    // The sent message clears itself once its time is up, here as on the server, which clears it for the rest of the
    // room (see PlayerMessageExpiryUtil) but not here, so that a line sent just then is never cleared with it.
    useEffect(() => {
        if (state.sentMessage.length == 0)
            return;
        const expiry = setTimeout(() => {
            const player = ClientObjectManager.getMyPlayer();
            if (player)
                setMyPlayerSentMessage(player, "", false);
            setState(prev => ({...prev, sentMessage: ""}));
        }, PLAYER_MESSAGE_EXPIRATION_MS);
        return () => clearTimeout(expiry);
    }, [state.sentMessage, state.sentMessageSince]);

    const setTextInput = (textInput: string) => {
        setState(prev => ({...prev, textInput}));
    };

    const sendMessage = (str: string) => {
        if (clientFeatureFlagsObservable.has(FeatureFlag.DisableChatSend))
            return;

        let message = str.trim();
        if (message.length == 0)
        {
            if (clientFeatureFlagsObservable.has(FeatureFlag.UseFallbackChatMessage))
                message = "Hello";
            else
                return;
        }

        const player = ClientObjectManager.getMyPlayer();
        if (!player)
        {
            console.error(`MyPlayer not found`);
            return;
        }

        setMyPlayerSentMessage(player, message);
        setState({textInput: "", sentMessage: message, sentMessageSince: Date.now()});
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
        setState(prev => ({...prev, sentMessage: ""}));
    };

    if (hide)
    {
        return null;
    }
    else
    {
        return <>
            {/* One row at every width; the field shrinks, not the button (see chatTextInput.tsx). */}
            <div className="flex flex-row flex-nowrap gap-x-1 p-2 w-full">
                <ChatTextInput textInput={state.textInput} setTextInput={setTextInput}/>
                <ChatSendButton textInput={state.textInput} sendMessage={sendMessage}/>
            </div>
            {state.sentMessage.length > 0 && <ChatSentMessage
                sentMessage={state.sentMessage}
                sentMessageSince={state.sentMessageSince}
                clearSentMessage={clearSentMessage}
            />}
        </>;
    }
}

// Sets the player's SentMessage ("" clears it). Multiplayer persists it via the server echo, and shows the helper that
// will hear it thinking at once; single-player sets it locally, which drives the bubble and step conditions, and is told
// to the room's helpers. Without telling the server, multiplayer shows it here alone.
function setMyPlayerSentMessage(player: GameObject, message: string, tellServer: boolean = true)
{
    const room = App.getCurrentRoom();
    if (room && room.roomType == RoomTypeEnumMap.SinglePlayer)
    {
        ClientObjectManager.setObjectMetadata(player.params.objectId,
            ObjectMetadataKeyEnumMap.SentMessage, message, false);
        if (message.length > 0)
            singlePlayerChatLineObservable.set(message);
    }
    else
    {
        (player.components.speechBubble as SpeechBubble).setMessage(message, tellServer);
        HelperThinkingUtil.expectAnswerTo(message);
    }
}

interface ChatState
{
    textInput: string;
    sentMessage: string;
    // When the sent message's time started: as it was sent, or as a room arrived with it.
    sentMessageSince: number;
}

interface Props
{
    hide: boolean;
}