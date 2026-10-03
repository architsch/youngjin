import express from "express";
import { Request, Response } from "express";
import User from "../../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../../shared/user/types/userType";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import UserIdentificationUtil from "../../../user/util/userIdentificationUtil";
import DBUserUtil from "../../../db/util/dbUserUtil";
import DBRoomUtil from "../../../db/util/dbRoomUtil";
import DBSearchUtil from "../../../db/util/dbSearchUtil";
import ServerRoomManager from "../../../room/serverRoomManager";
import OwnedRoomUtil from "../../../room/util/ownedRoomUtil";
import HubRoomUtil from "../../../room/util/hubRoomUtil";
import RoomListEntry from "../../../../shared/room/types/roomListEntry";
import DBRoom from "../../../db/types/row/dbRoom";
import Room from "../../../../shared/room/types/room";
import RoomFile from "../../../../shared/room/types/roomFile";
import RoomValidationUtil from "../../../../shared/room/util/roomValidationUtil";
import BufferState from "../../../../shared/networking/types/bufferState";
import { MAX_ENCODED_OBJECTS_BYTES } from "../../../../shared/networking/util/encodingUtil";
import { MAX_ENCODED_VOXEL_GRID_BYTES } from "../../../../shared/system/sharedConstants";

const RoomRouter = express.Router();

// Page size for room-list responses (and the unit for the client's pagination cursor).
const ROOM_LIST_PAGE_SIZE = 10;
// Search scan cap: Firestore has no substring queries, so search filters a paged scan in memory.
const ROOM_SEARCH_MAX_SCAN = 500;
// A room file is written through the encoding buffer (see EncodingUtil), so none is longer than it.
const MAX_ROOM_FILE_BYTES = MAX_ENCODED_VOXEL_GRID_BYTES + MAX_ENCODED_OBJECTS_BYTES;

// Regular rooms: a member's one owned room. Hubs: admin-only world-building.
RoomRouter.post("/create_room", UserIdentificationUtil.identifyRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = User.fromString((req as any).userString);

    if (user.userType === UserTypeEnumMap.Guest)
    {
        res.status(403).send("Guest users cannot create rooms.");
        return;
    }

    const { roomType } = req.body;
    if (roomType === RoomTypeEnumMap.Hub)
    {
        if (user.userType !== UserTypeEnumMap.Admin)
        {
            res.status(403).send("Only an admin can create a hub.");
            return;
        }
        // Via HubRoomUtil: unowned, preloaded for balancing, and not counted as the admin's owned room.
        const newHubID = await HubRoomUtil.createHub();
        if (newHubID.length === 0)
        {
            res.status(500).send("Failed to create hub.");
            return;
        }
        res.status(200).json({ roomID: newHubID });
        return;
    }
    if (roomType !== undefined && roomType !== RoomTypeEnumMap.Regular)
    {
        res.status(400).send("Invalid roomType.");
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

    const newRoomID = await OwnedRoomUtil.createOwnedRoom(user.id, dbUser.userName);
    if (newRoomID.length === 0)
    {
        res.status(500).send("Failed to create room.");
        return;
    }

    res.status(200).json({ roomID: newRoomID });
});

// Permission via resolveConfigurableRoom.
RoomRouter.post("/change_room_texture", UserIdentificationUtil.identifyRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = User.fromString((req as any).userString);

    const { texturePackPath, roomID } = req.body;
    if (!texturePackPath || typeof texturePackPath !== "string")
    {
        res.status(400).send("Missing or invalid texturePackPath.");
        return;
    }

    const room = await resolveConfigurableRoom(user, roomID, res);
    if (!room)
        return;

    const success = await ServerRoomManager.changeRoomTexturePack(room, texturePackPath);
    if (!success)
    {
        res.status(500).send("Failed to change room texture.");
        return;
    }

    res.status(200).send("Room texture updated.");
});

// Changes room prefs (permission as for texture packs). Input isn't validated here; ServerRoomManager
// canonicalizes it (see changeRoomPrefs).
RoomRouter.post("/change_room_prefs", UserIdentificationUtil.identifyRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = User.fromString((req as any).userString);

    const { prefs, roomID } = req.body;
    if (typeof prefs !== "string")
    {
        res.status(400).send("Missing or invalid prefs.");
        return;
    }

    const room = await resolveConfigurableRoom(user, roomID, res);
    if (!room)
        return;

    const success = await ServerRoomManager.changeRoomPrefs(room, prefs);
    if (!success)
    {
        res.status(500).send("Failed to change room lighting.");
        return;
    }

    res.status(200).send("Room lighting updated.");
});

// Overwrites the room the caller stands in with a room file, sent as the request's body (see RoomFile).
// An admin's alone, and only in a room that admin is the superuser of.
RoomRouter.post("/load_room_file", UserIdentificationUtil.identifyAdmin,
    express.raw({ type: "application/octet-stream", limit: MAX_ROOM_FILE_BYTES }),
    async (req: Request, res: Response): Promise<void> => {
    const user = User.fromString((req as any).userString);

    const roomID = req.query.roomID;
    if (typeof roomID !== "string" || roomID.length === 0)
    {
        res.status(400).send("Missing or invalid roomID.");
        return;
    }

    // The room the caller is in, which is therefore loaded.
    const roomRuntimeMemory = (ServerRoomManager.currentRoomIDByUserID[user.id] === roomID)
        ? ServerRoomManager.roomRuntimeMemories[roomID] : undefined;
    if (!roomRuntimeMemory)
    {
        res.status(409).send("You are not in this room.");
        return;
    }
    if (!RoomValidationUtil.isRoomSuperuser(user, roomRuntimeMemory.room))
    {
        res.status(403).send("You may only load a file over a hub or your own room.");
        return;
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0)
    {
        res.status(400).send("Missing room file.");
        return;
    }

    let roomFile: RoomFile;
    try
    {
        roomFile = RoomFile.decodeWithParams(new BufferState(new Uint8Array(req.body)), roomID) as RoomFile;
    }
    catch (err)
    {
        console.warn(`RoomRouter :: Refused a room file (userID = ${user.id}, roomID = ${roomID}) :: ${err instanceof Error ? err.message : err}`);
        res.status(400).send("Not a room file this server can read.");
        return;
    }

    const success = await ServerRoomManager.loadRoomFile(roomID, roomFile);
    if (!success)
    {
        res.status(500).send("Failed to load the room file.");
        return;
    }

    res.status(200).send("Room file loaded.");
});

// Offset-paginated room list. The client hides entries it pins separately.
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

// Case-insensitive substring search over ownerUserName via a capped in-memory scan.
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

    // Collect enough matches for this page (+1 for hasMore), up to the scan cap or collection end.
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
    // More matches than this page, or the cap was hit before the end.
    const hasMore = matches.length > targetSkip + ROOM_LIST_PAGE_SIZE || (!exhausted && scanned >= ROOM_SEARCH_MAX_SCAN);

    res.status(200).json({ rooms: slice.map(toRoomListEntry), hasMore });
});

RoomRouter.post("/get_hub_room_list_entries", UserIdentificationUtil.identifyAnyUser, async (_req: Request, res: Response): Promise<void> => {
    const result = await DBSearchUtil.rooms.withRoomType(RoomTypeEnumMap.Hub);
    if (!result.success)
    {
        res.status(500).send("Failed to query hub rooms.");
        return;
    }
    if (result.data.length === 0)
    {
        res.status(404).send("Hub room not found.");
        return;
    }
    res.status(200).json({
        rooms: result.data.map(dataEntry => toRoomListEntry(dataEntry))
    });
});

RoomRouter.post("/get_my_room_list_entry", UserIdentificationUtil.identifyAnyUser, async (req: Request, res: Response): Promise<void> => {
    const user = User.fromString((req as any).userString);

    const dbUser = await DBUserUtil.findUserById(user.id);
    if (!dbUser || !dbUser.ownedRoomID || dbUser.ownedRoomID.length === 0)
    {
        res.status(200).json({ room: null });
        return;
    }

    const dbRoom = await DBRoomUtil.getDBRoom(dbUser.ownedRoomID);
    if (!dbRoom)
    {
        res.status(200).json({ room: null });
        return;
    }
    res.status(200).json({ room: toRoomListEntry(dbRoom) });
});

// Resolves the room for a decoration request, or null after sending an error. Allowed: a room the
// caller owns, or a hub for an admin. Everything else is refused.
async function resolveConfigurableRoom(user: User, roomID: unknown, res: Response): Promise<Room | null>
{
    if (typeof roomID !== "string" || roomID.length === 0)
    {
        res.status(400).send("Missing or invalid roomID.");
        return null;
    }

    const dbRoom = await DBRoomUtil.getDBRoom(roomID);
    if (!dbRoom)
    {
        res.status(404).send("Room not found.");
        return null;
    }

    // Checked against the room's owner, requiring non-empty ids so "nobody" never matches "nobody".
    const ownerUserID = dbRoom.ownerUserID ?? "";
    const callerOwnsIt = ownerUserID.length > 0 && ownerUserID === user.id;
    const callerAdministersIt = dbRoom.roomType === RoomTypeEnumMap.Hub
        && user.userType === UserTypeEnumMap.Admin;
    if (!callerOwnsIt && !callerAdministersIt)
    {
        res.status(403).send("You may only decorate a room you own, or — as an admin — a hub.");
        return null;
    }

    // Room contents (what decoration rewrites).
    const room = await DBRoomUtil.getRoomContent(roomID);
    if (!room)
    {
        res.status(404).send("Room not found.");
        return null;
    }
    return room;
}

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
