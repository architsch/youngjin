import App from "../../app";
import ClientObjectManager from "../clientObjectManager";
import SocketsClient from "../../networking/client/socketsClient";
import { gameModeObservable } from "../../system/clientObservables";
import GameMode from "../../system/types/gameMode";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";

// The user's player shows them editing while they are in edit mode, in place of their words (see SpeechBubble), so that
// the room can tell: set on the player as the mode changes, and passed on by the server in a multiplayer room. Every room
// arrival is in play mode (see GameModeUtil), on a player that never comes back editing (see ServerUserManager).
gameModeObservable.addListener("playerEditingUtil", (mode: GameMode) => {
    const room = App.getCurrentRoom();
    const player = ClientObjectManager.getMyPlayer();
    const editing = (mode == "edit") ? "1" : "";
    if (room == undefined || player == undefined
        || (player.params.metadata[ObjectMetadataKeyEnumMap.Editing]?.str ?? "") == editing)
    {
        return;
    }
    ClientObjectManager.setObjectMetadata(player.params.objectId, ObjectMetadataKeyEnumMap.Editing, editing);
    if (room.roomType != RoomTypeEnumMap.SinglePlayer)
    {
        SocketsClient.emitSetObjectMetadataSignal(new SetObjectMetadataSignal(room.id, player.params.objectId,
            ObjectMetadataKeyEnumMap.Editing, editing));
    }
});
