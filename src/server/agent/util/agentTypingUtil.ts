import ServerUserManager from "../../user/serverUserManager";
import ServerObjectManager from "../../object/serverObjectManager";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { SpeakerActivityEnumMap } from "../../../shared/object/types/speakerActivity";
import SpeakerActivityUtil from "../../../shared/object/util/speakerActivityUtil";
import { AGENT_TYPING_EXPIRATION_MS } from "../../system/serverConstants";
import UserContext from "../../sockets/types/userContext";
import HelperAgentUtil from "./helperAgentUtil";

// When each agent's typing stops by itself, by user ID.
const expiresAtByUserID = new Map<string, number>();

// An agent says when it starts typing a line (see AgentToolUtil.typing), and has no browser to say when it stops: its
// typing ends with the line it says, or else with its time, as a person's lapses (see ChatTypingUtil). The server ends
// it as the agent would, whatever is left of the agent's budgets.
const AgentTypingUtil =
{
    expiresAtByUserID,
    // Starts the time of the typing the agent has just shown.
    noteTyping: (userID: string): void =>
    {
        expiresAtByUserID.set(userID, Date.now() + AGENT_TYPING_EXPIRATION_MS);
    },
    stop: (ctx: UserContext): void =>
    {
        expiresAtByUserID.delete(ctx.user.id);
        const player = ServerUserManager.getPlayerObject(ctx.user.id);
        if (player == undefined || SpeakerActivityUtil.get(player) != SpeakerActivityEnumMap.Typing)
            return;
        ServerObjectManager.onSetObjectMetadataSignalReceived(ctx, new SetObjectMetadataSignal(player.roomID,
            player.objectId, ObjectMetadataKeyEnumMap.Activity, SpeakerActivityEnumMap.None));
        HelperAgentUtil.noteTyping(ctx);
    },
    // Ends each agent's typing whose time is up (see SocketsServer's flush). One that has left is let go.
    expireAll: (): void =>
    {
        const now = Date.now();
        for (const [userID, expiresAt] of expiresAtByUserID)
        {
            if (expiresAt > now)
                continue;
            expiresAtByUserID.delete(userID);
            const ctx = ServerUserManager.getSocketUserContext(userID);
            if (ctx != undefined)
                AgentTypingUtil.stop(ctx);
        }
    },
}

export default AgentTypingUtil;
