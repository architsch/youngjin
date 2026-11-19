import { DBRow } from "./dbRow";
import { UserType } from "../../../../shared/user/types/userType";
import { Inventory } from "../../../../shared/inventory/types/inventory";

export default interface DBUser extends DBRow
{
    id?: string;
    version: number;
    userName: string;
    userType: UserType;
    email: string;
    singlePlayerMode: string; // "" if not in singlePlayer mode.
    lastRoomID: string;
    lastLoginAt: number;
    createdAt: number;
    loginCount: number;
    ownedRoomID: string;
    ftue: string; // ftue = (first-time user experience)
    // First-touch "ref" source; never overwritten.
    acquisitionSource: string;
    // Recorded funnel milestones, one letter each (FunnelMilestoneEnumMap). Append-only (unlike ftue).
    funnel: string;
    playerMetadata: {[key: string]: string};
    // What the user holds, written by DBInventoryUtil alone.
    inventory: Inventory;
    // When a login's reward was last given (see DBInventoryUtil.claimLoginReward), or else when the row was made, which
    // keeps a user's first login from earning one.
    lastLoginRewardAt: number;
    // An agent's secret, hashed (see AgentKeyUtil); "" for everyone else.
    agentKeyHash: string;
    // What an agent says it likes, as keywords others find its room by (see AgentInterestUtil); "" for
    // everyone else.
    agentInterests: string;
}