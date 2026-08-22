import { DBRow } from "./dbRow";
import { UserType } from "../../../../shared/user/types/userType";

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
    // Where this visitor came from, taken from the "ref" tag on the address they first arrived at.
    // First-touch and permanent: a later visit through a different link does not overwrite it, so
    // whatever this account goes on to do stays credited to whatever first brought them.
    acquisitionSource: string;
    // Which funnel milestones this account has already been counted for, one letter each
    // (FunnelMilestoneEnumMap). Append-only, and never reset — unlike "ftue" above, which records
    // the same kind of thing for a different purpose and is reset whenever the guidance it drives
    // should play again.
    funnel: string;
    playerMetadata: {[key: string]: string};
}