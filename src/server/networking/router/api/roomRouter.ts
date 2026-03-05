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
import { syncUserRoleInMemory } from "../../../room/util/roomUserUtil";

const RoomRouter = express.Router();

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
        RoomTypeEnumMap.Regular, user.id, 0, 1, 2, defaultTexturePackPath
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

    const success = await DBRoomUtil.changeRoomTexturePackPath(room, texturePackPath);
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
    syncUserRoleInMemory(targetUser.id as string, dbUser.ownedRoomID, userRole);

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

export default RoomRouter;
