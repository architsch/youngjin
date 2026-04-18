import express from "express";
import { Request, Response } from "express";
import User from "../../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../../shared/user/types/userType";
import { UserRoleEnumMap } from "../../../../shared/user/types/userRole";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import UserIdentificationUtil from "../../../user/util/userIdentificationUtil";
import DBUserUtil from "../../../db/util/dbUserUtil";
import DBRoomUtil from "../../../db/util/dbRoomUtil";
import DBUserRoomStateUtil from "../../../db/util/dbUserRoomStateUtil";
import DBSearchUtil from "../../../db/util/dbSearchUtil";
import AddressUtil from "../../util/addressUtil";
import ServerUserManager from "../../../user/serverUserManager";
import ServerRoomManager from "../../../room/serverRoomManager";
import RoomListEntry from "../../../../shared/room/types/roomListEntry";
import DBRoom from "../../../db/types/row/dbRoom";

const RoomRouter = express.Router();

// Page size for room-list responses (and the unit for the client's pagination cursor).
const ROOM_LIST_PAGE_SIZE = 10;
// Hard cap on rooms scanned per search call. Firestore can't do substring matches,
// so search is implemented as an in-memory filter over a paged scan; this bound prevents
// a single search from runaway-scanning the whole collection.
const ROOM_SEARCH_MAX_SCAN = 500;

RoomRouter.post("/create_room", UserIdentificationUtil.identifyRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = User.fromString((req as any).userString);

    if (user.userType === UserTypeEnumMap.Guest)
    {
        res.status(403).send("Guest users cannot create rooms.");
        return;
    }

    // Look up the full DB user to check ownedRoomID
    const dbUser = await DBUserUtil.findUserById(user.id);
    if (!dbUser)
    {
        res.status(404).send("User not found.");
        return;
    }
    if (dbUser.ownedRoomID && dbUser.ownedRoomID.length > 0)
    {
        res.status(409).send("User already owns a room.");
        return;
    }

    const defaultTexturePackPath = `${AddressUtil.getEnvStaticURL()}/app/assets/texture_packs/default.jpg`;
    const createResult = await DBRoomUtil.createRoom(
        RoomTypeEnumMap.Regular, user.id, dbUser.userName, 0, 1, 2, defaultTexturePackPath
    );
    if (!createResult.success || createResult.data.length === 0)
    {
        res.status(500).send("Failed to create room.");
        return;
    }

    const newRoomID = createResult.data[0].id;
    await DBUserUtil.setOwnedRoomID(user.id, newRoomID);

    res.status(200).json({ roomID: newRoomID });
});

RoomRouter.post("/change_room_texture", UserIdentificationUtil.identifyRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = User.fromString((req as any).userString);

    const dbUser = await DBUserUtil.findUserById(user.id);
    if (!dbUser)
    {
        res.status(404).send("User not found.");
        return;
    }
    if (!dbUser.ownedRoomID || dbUser.ownedRoomID.length === 0)
    {
        res.status(403).send("User does not own a room.");
        return;
    }

    const { texturePackPath } = req.body;
    if (!texturePackPath || typeof texturePackPath !== "string")
    {
        res.status(400).send("Missing or invalid texturePackPath.");
        return;
    }

    const room = await DBRoomUtil.getRoomContent(dbUser.ownedRoomID);
    if (!room)
    {
        res.status(404).send("Room not found.");
        return;
    }

    const success = await ServerRoomManager.changeRoomTexturePack(room, texturePackPath);
    if (!success)
    {
        res.status(500).send("Failed to change room texture.");
        return;
    }

    res.status(200).send("Room texture updated.");
});

RoomRouter.post("/set_room_user_role", UserIdentificationUtil.identifyRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = User.fromString((req as any).userString);

    const dbUser = await DBUserUtil.findUserById(user.id);
    if (!dbUser)
    {
        res.status(404).send("User not found.");
        return;
    }
    if (!dbUser.ownedRoomID || dbUser.ownedRoomID.length === 0)
    {
        res.status(403).send("User does not own a room.");
        return;
    }

    const { targetUserName, userRole } = req.body;
    if (!targetUserName || typeof targetUserName !== "string")
    {
        res.status(400).send("Missing or invalid targetUserName.");
        return;
    }
    if (userRole !== UserRoleEnumMap.Editor && userRole !== UserRoleEnumMap.Visitor)
    {
        res.status(400).send("userRole must be Editor or Visitor.");
        return;
    }

    const searchResult = await DBSearchUtil.users.withUserName(targetUserName);
    if (!searchResult.success || searchResult.data.length === 0)
    {
        res.status(404).send("Target user not found.");
        return;
    }
    const targetUser = searchResult.data[0];
    if (targetUser.id === user.id)
    {
        res.status(400).send("Cannot change your own role.");
        return;
    }

    await DBUserRoomStateUtil.setUserRole(targetUser.id as string, targetUser.userName, targetUser.email, dbUser.ownedRoomID, userRole);

    // Sync the role change in the server's in-memory state and broadcast to clients.
    ServerUserManager.syncUserRoleInMemory(targetUser.id as string, dbUser.ownedRoomID, userRole);

    res.status(200).send("User role updated.");
});

RoomRouter.post("/get_room_editors", UserIdentificationUtil.identifyRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = User.fromString((req as any).userString);

    const dbUser = await DBUserUtil.findUserById(user.id);
    if (!dbUser)
    {
        res.status(404).send("User not found.");
        return;
    }
    if (!dbUser.ownedRoomID || dbUser.ownedRoomID.length === 0)
    {
        res.status(403).send("User does not own a room.");
        return;
    }

    const statesResult = await DBSearchUtil.userRoomStates.withUserRoleInRoom(dbUser.ownedRoomID, UserRoleEnumMap.Editor);
    if (!statesResult.success)
    {
        res.status(500).send("Failed to query editors.");
        return;
    }

    const editors = statesResult.data.map(state => ({
        userName: state.userName,
        email: state.email,
    }));

    res.status(200).json({ editors });
});

// List rooms with offset-based pagination. The client is responsible for hiding
// "special entries" (Hub, the user's own room) that it pins above the regular list.
RoomRouter.post("/list_rooms", UserIdentificationUtil.identifyAnyUser, async (req: Request, res: Response): Promise<void> => {
    const page = parsePage(req.body?.page);

    // Fetch one extra row so we can detect whether more pages exist.
    const result = await DBSearchUtil.rooms.page(page * ROOM_LIST_PAGE_SIZE, ROOM_LIST_PAGE_SIZE + 1);
    if (!result.success)
    {
        res.status(500).send("Failed to query rooms.");
        return;
    }

    const rooms = result.data.slice(0, ROOM_LIST_PAGE_SIZE).map(toRoomListEntry);
    const hasMore = result.data.length > ROOM_LIST_PAGE_SIZE;

    res.status(200).json({ rooms, hasMore });
});

// Substring search over ownerUserName (case-insensitive). Firestore has no substring
// operator, so this scans rooms in chunks and filters in memory; the scan is hard-capped
// at ROOM_SEARCH_MAX_SCAN to keep latency bounded.
RoomRouter.post("/search_rooms", UserIdentificationUtil.identifyAnyUser, async (req: Request, res: Response): Promise<void> => {
    const rawQuery = typeof req.body?.query === "string" ? req.body.query : "";
    const query = rawQuery.trim().toLowerCase();
    if (query.length === 0)
    {
        res.status(400).send("Missing or empty query.");
        return;
    }
    const page = parsePage(req.body?.page);

    const targetSkip = page * ROOM_LIST_PAGE_SIZE;
    const matches: DBRoom[] = [];
    let scanned = 0;
    let scanOffset = 0;
    let exhausted = false;
    const CHUNK = 50;

    // Scan until we've collected enough matches to satisfy this page (with one extra
    // to detect hasMore), or we hit the scan cap, or we've exhausted the collection.
    while (matches.length < targetSkip + ROOM_LIST_PAGE_SIZE + 1 && scanned < ROOM_SEARCH_MAX_SCAN)
    {
        const chunkLimit = Math.min(CHUNK, ROOM_SEARCH_MAX_SCAN - scanned);
        const chunkResult = await DBSearchUtil.rooms.page(scanOffset, chunkLimit);
        if (!chunkResult.success)
        {
            res.status(500).send("Failed to query rooms.");
            return;
        }

        for (const room of chunkResult.data)
        {
            if (room.ownerUserName && room.ownerUserName.toLowerCase().includes(query))
                matches.push(room);
        }

        scanned += chunkResult.data.length;
        scanOffset += chunkLimit;

        if (chunkResult.data.length < chunkLimit)
        {
            exhausted = true;
            break;
        }
    }

    const slice = matches.slice(targetSkip, targetSkip + ROOM_LIST_PAGE_SIZE);
    // hasMore: we have more accumulated matches than this page, OR we hit the scan cap
    // without exhausting the collection (so additional matches may exist further in).
    const hasMore = matches.length > targetSkip + ROOM_LIST_PAGE_SIZE || (!exhausted && scanned >= ROOM_SEARCH_MAX_SCAN);

    res.status(200).json({ rooms: slice.map(toRoomListEntry), hasMore });
});

// Returns a single room's metadata for the special "hub" entry. The client pins this
// at the top of the list independently of pagination.
RoomRouter.post("/get_hub_room", UserIdentificationUtil.identifyAnyUser, async (_req: Request, res: Response): Promise<void> => {
    const result = await DBSearchUtil.rooms.withRoomType(RoomTypeEnumMap.Hub);
    if (!result.success)
    {
        res.status(500).send("Failed to query hub room.");
        return;
    }
    if (result.data.length === 0)
    {
        res.status(404).send("Hub room not found.");
        return;
    }
    res.status(200).json({ room: toRoomListEntry(result.data[0]) });
});

// Returns the current user's owned-room metadata (or null if they don't own one yet).
// Used by the client to populate the "My Room" special entry.
RoomRouter.post("/get_my_room", UserIdentificationUtil.identifyAnyUser, async (req: Request, res: Response): Promise<void> => {
    const user = User.fromString((req as any).userString);

    const dbUser = await DBUserUtil.findUserById(user.id);
    if (!dbUser || !dbUser.ownedRoomID || dbUser.ownedRoomID.length === 0)
    {
        res.status(200).json({ room: null });
        return;
    }

    const dbRoom = await DBRoomUtil.getRoomMetadata(dbUser.ownedRoomID);
    if (!dbRoom)
    {
        res.status(200).json({ room: null });
        return;
    }
    res.status(200).json({ room: toRoomListEntry(dbRoom) });
});

function toRoomListEntry(room: DBRoom): RoomListEntry
{
    return {
        id: room.id ?? "",
        roomType: room.roomType,
        ownerUserID: room.ownerUserID ?? "",
        ownerUserName: room.ownerUserName ?? "",
    };
}

function parsePage(value: unknown): number
{
    const n = typeof value === "number" ? value : parseInt(value as string);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
}

export default RoomRouter;
