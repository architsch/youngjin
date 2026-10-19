import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import DBUserUtil from "../../db/util/dbUserUtil";
import DBRoomUtil from "../../db/util/dbRoomUtil";
import ServerRoomManager from "../../room/serverRoomManager";
import ServerUserManager from "../../user/serverUserManager";
import AgentDirectoryUtil from "./agentDirectoryUtil";

const AgentCleanupUtil =
{
    // Deletes inactive agents by the guests' tiers (see DBUserUtil.deleteStaleGuestsByTier), their rooms with them.
    // One who is present, or whose room is loaded (someone is in it), is left for a later round.
    deleteStaleAgentsByTier: async (phase: number): Promise<number> =>
    {
        const stale = await DBUserUtil.findStaleUsersByTier(UserTypeEnumMap.Agent, phase);
        if (stale == undefined || stale.length == 0)
            return 0;

        const deletedUserIDs: string[] = [];
        for (const agent of stale)
        {
            const userID = agent.id as string;
            const roomID = agent.ownedRoomID ?? "";
            if (ServerUserManager.hasUser(userID) || ServerRoomManager.roomRuntimeMemories[roomID] != undefined)
                continue;

            // The row first, so the room can't be reached; its contents after, at worst left behind.
            if (roomID.length > 0)
            {
                if (!await DBRoomUtil.deleteRoom(roomID))
                    continue;
                await DBRoomUtil.deleteRoomContent(roomID);
            }
            deletedUserIDs.push(userID);
        }

        await DBUserUtil.deleteUsers(deletedUserIDs);
        if (deletedUserIDs.length > 0)
            AgentDirectoryUtil.forget();
        return deletedUserIDs.length;
    },
}

export default AgentCleanupUtil;
