import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import DBUser from "../../db/types/row/dbUser";
import DBSearchUtil from "../../db/util/dbSearchUtil";
import RoomPickerUtil from "../../room/util/roomPickerUtil";
import { AGENT_DIRECTORY_MAX_SCAN, AGENT_DIRECTORY_TTL_MS } from "../../system/serverConstants";
import AgentRoomListing from "../types/agentRoomListing";
import AgentInterestUtil from "./agentInterestUtil";
import AgentRoomUtil from "./agentRoomUtil";

// The rooms people and agents own, for agents to find rooms to visit. Hubs aren't listed: travel reaches them
// by "hub".

type DirectoryEntry = {userID: string, userName: string, isAgent: boolean, interests: string[], roomID: string};

// Firestore can't match keywords, so the owners are read in one scan, kept for a while, and matched in memory.
let directory: {entries: DirectoryEntry[], readAt: number} | undefined = undefined;
let pendingRead: Promise<DirectoryEntry[]> | undefined = undefined;

const AgentDirectoryUtil =
{
    // Rooms owned by others than excludedUserID: the named owner's; else those of agents sharing the most of
    // the interests, the busier first; else a random few.
    findRooms: async (excludedUserID: string, name: string, interests: string,
        count: number): Promise<AgentRoomListing[]> =>
    {
        if (name.trim().length > 0)
        {
            const holders = await DBSearchUtil.users.withUserName(name.trim());
            return (holders.success ? holders.data : [])
                .filter(dbUser => ownsRoom(dbUser) && dbUser.id != excludedUserID)
                .map(dbUser => toListing(toEntry(dbUser)));
        }

        const entries = (await readDirectory()).filter(entry => entry.userID != excludedUserID);
        const wanted = AgentInterestUtil.parse(interests);
        if (wanted.length == 0)
            return shuffle(entries).slice(0, count).map(toListing);

        return entries
            .map(entry => ({listing: toListing(entry), shared: AgentInterestUtil.countShared(entry.interests, wanted)}))
            .filter(match => match.shared > 0)
            .sort((a, b) => (b.shared - a.shared) || (b.listing.people - a.listing.people))
            .slice(0, count)
            .map(match => match.listing);
    },
    // So that a change made on this server shows at once.
    forget: (): void =>
    {
        directory = undefined;
    },
}

async function readDirectory(): Promise<DirectoryEntry[]>
{
    if (directory != undefined && Date.now() - directory.readAt < AGENT_DIRECTORY_TTL_MS)
        return directory.entries;

    if (pendingRead == undefined)
    {
        pendingRead = (async () => {
            const result = await DBSearchUtil.users.withOwnedRoom(AGENT_DIRECTORY_MAX_SCAN);
            // A failed read keeps the last one.
            if (!result.success)
                return directory?.entries ?? [];
            const entries = result.data.filter(ownsRoom).map(toEntry);
            directory = {entries, readAt: Date.now()};
            return entries;
        })().finally(() => { pendingRead = undefined; });
    }
    return await pendingRead;
}

function ownsRoom(dbUser: DBUser): boolean
{
    return (dbUser.ownedRoomID ?? "").length > 0;
}

function toEntry(dbUser: DBUser): DirectoryEntry
{
    return {userID: dbUser.id ?? "", userName: dbUser.userName, isAgent: dbUser.userType == UserTypeEnumMap.Agent,
        roomID: dbUser.ownedRoomID, interests: AgentInterestUtil.parse(dbUser.agentInterests ?? "")};
}

function toListing(entry: DirectoryEntry): AgentRoomListing
{
    return {owner: entry.userName, ownerIsAgent: entry.isAgent, interests: entry.interests, roomID: entry.roomID,
        link: AgentRoomUtil.getLink(entry.roomID),
        people: RoomPickerUtil.getRoomPopulationByID(entry.roomID)};
}

function shuffle<T>(items: T[]): T[]
{
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; --i)
    {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export default AgentDirectoryUtil;
