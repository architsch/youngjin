import App from "../../app";
import ClientObjectManager from "../clientObjectManager";
import SocketsClient from "../../networking/client/socketsClient";
import { chatTypingObservable, gameModeObservable, roomChangedObservable,
    webPageOpenObservable } from "../../system/clientObservables";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { SpeakerActivity, SpeakerActivityEnumMap } from "../../../shared/object/types/speakerActivity";
import SpeakerActivityUtil from "../../../shared/object/util/speakerActivityUtil";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import AsyncUtil from "../../../shared/system/util/asyncUtil";

const MY_PLAYER_WAIT_MS = 5000;

// The user's player shows the room what they are busy with (see SpeechBubble), and holds a helper still for a line they
// are typing (see HelperAgentUtil): set on the player as it changes, and passed on by the server in a multiplayer room.
// A player arrives busy with nothing (see ServerUserManager), so it is told again on each arrival. A camera page has no
// player of its own.
const PlayerActivityUtil =
{
    install: (): void =>
    {
        if (App.getWatchedUserID().length > 0)
            return;
        gameModeObservable.addListener("playerActivityUtil", showActivity);
        chatTypingObservable.addListener("playerActivityUtil", showActivity);
        webPageOpenObservable.addListener("playerActivityUtil", showActivity);
        document.addEventListener("visibilitychange", showActivity);
        roomChangedObservable.addListener("playerActivityUtil", async () => {
            await AsyncUtil.waitUntilSuccess(() => ClientObjectManager.getMyPlayer() != undefined, MY_PLAYER_WAIT_MS);
            showActivity();
        });
    },
}

// Whatever takes the user away from the room comes first. Another tab is taken for reading, as nothing else can be told
// of it (only a hidden page counts: one in sight is the user's, focused or not).
function getActivity(): SpeakerActivity
{
    if (webPageOpenObservable.peek() || document.visibilityState == "hidden")
        return SpeakerActivityEnumMap.Reading;
    if (gameModeObservable.peek() == "edit")
        return SpeakerActivityEnumMap.Editing;
    return chatTypingObservable.peek() ? SpeakerActivityEnumMap.Typing : SpeakerActivityEnumMap.None;
}

// Without a connection, the server isn't told: socket.io would send it on connecting, about a player gone by then.
function showActivity(): void
{
    const room = App.getCurrentRoom();
    const player = ClientObjectManager.getMyPlayer();
    const activity = getActivity();
    if (room == undefined || player == undefined || SpeakerActivityUtil.get(player.params) == activity)
        return;
    ClientObjectManager.setObjectMetadata(player.params.objectId, ObjectMetadataKeyEnumMap.Activity, activity);
    if (room.roomType != RoomTypeEnumMap.SinglePlayer && SocketsClient.isConnected())
    {
        SocketsClient.emitSetObjectMetadataSignal(new SetObjectMetadataSignal(room.id, player.params.objectId,
            ObjectMetadataKeyEnumMap.Activity, activity));
    }
}

export default PlayerActivityUtil;
