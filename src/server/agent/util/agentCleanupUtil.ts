import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import { FunnelMilestoneEnumMap } from "../../analytics/types/funnelMilestone";
import DBUser from "../../db/types/row/dbUser";
import DBUserUtil from "../../db/util/dbUserUtil";
import DBRoomUtil from "../../db/util/dbRoomUtil";
import DBAgentAwayEventsUtil from "../../db/util/dbAgentAwayEventsUtil";
import ServerRoomManager from "../../room/serverRoomManager";
import ServerUserManager from "../../user/serverUserManager";
import { BUILDER_AGENT_KEPT_FOR_GOOD_LOGIN_COUNT, BUILDER_AGENT_MAX_AGE_BY_TIER_PHASE } from "../../system/serverConstants";
import AgentDirectoryUtil from "./agentDirectoryUtil";

const AgentCleanupUtil =
{
    // Deletes inactive agents by the guests' tiers (see DBUserUtil.deleteStaleGuestsByTier), their rooms with them; one
    // that has built, by far longer ones (see isKeptForBuilding). One who is present, or whose room is loaded (someone
    // is in it), is left for a later round.
    deleteStaleAgentsByTier: async (phase: number): Promise<number> =>
    {
        const stale = await DBUserUtil.findStaleUsersByTier(UserTypeEnumMap.Agent, phase);
        if (stale == undefined || stale.length == 0)
            return 0;

        const now = Date.now();
        const deletedUserIDs: string[] = [];
        for (const agent of stale)
        {
            const userID = agent.id as string;
            const roomID = agent.ownedRoomID ?? "";
            if (isKeptForBuilding(agent, phase, now) || ServerUserManager.hasUser(userID)
                || ServerRoomManager.roomRuntimeMemories[roomID] != undefined)
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
        await Promise.all(deletedUserIDs.map(userID => DBAgentAwayEventsUtil.remove(userID)));
        return deletedUserIDs.length;
    },
}

// An agent that has built outlasts the guests' tier it is stale by: its own tier's longer age, and for good once it has
// logged in often enough. Each longer age exceeds the guests', so the guests' query finds every agent this lets go; those
// it keeps are read again each round, a cost that grows with them.
function isKeptForBuilding(agent: DBUser, phase: number, now: number): boolean
{
    if (!(agent.funnel ?? "").includes(FunnelMilestoneEnumMap.Built))
        return false;
    return (agent.loginCount ?? 0) >= BUILDER_AGENT_KEPT_FOR_GOOD_LOGIN_COUNT
        || agent.lastLoginAt >= now - BUILDER_AGENT_MAX_AGE_BY_TIER_PHASE[phase];
}

export default AgentCleanupUtil;
