import ServerUserManager from "../serverUserManager";
import ServerObjectManager from "../../object/serverObjectManager";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { PLAYER_MESSAGE_EXPIRATION_MS } from "../../../shared/system/sharedConstants";

// When each user's message clears itself, by user ID.
const expiresAtByUserID = new Map<string, number>();

// A player's message clears itself PLAYER_MESSAGE_EXPIRATION_MS after it is said, or after its player arrives in a room
// still saying it. The server clears it for the room as its user would; the user's own browser clears it for itself
// (see Chat), so a line said just as the last one's time runs out is never cleared with it.
const PlayerMessageExpiryUtil =
{
    expiresAtByUserID,
    // Starts the time of what the user's player says now, if anything.
    noteMessage: (userID: string): void =>
    {
        if (getMessage(userID).length > 0)
            expiresAtByUserID.set(userID, Date.now() + PLAYER_MESSAGE_EXPIRATION_MS);
    },
    // Clears each message whose time is up (see SocketsServer's flush). One cleared already is let go.
    expireAll: (): void =>
    {
        const now = Date.now();
        for (const [userID, expiresAt] of expiresAtByUserID)
        {
            if (expiresAt > now)
                continue;
            expiresAtByUserID.delete(userID);
            const ctx = ServerUserManager.getSocketUserContext(userID);
            const player = ServerUserManager.getPlayerObject(userID);
            if (ctx == undefined || player == undefined || getMessage(userID).length == 0)
                continue;
            ServerObjectManager.onSetObjectMetadataSignalReceived(ctx, new SetObjectMetadataSignal(player.roomID,
                player.objectId, ObjectMetadataKeyEnumMap.SentMessage, ""));
        }
    },
}

function getMessage(userID: string): string
{
    return ServerUserManager.getPlayerObject(userID)?.metadata[ObjectMetadataKeyEnumMap.SentMessage]?.str ?? "";
}

export default PlayerMessageExpiryUtil;
