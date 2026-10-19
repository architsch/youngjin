import UserContext from "../../sockets/types/userContext";
import ServerUserManager from "../serverUserManager";
import ServerRoomManager from "../../room/serverRoomManager";
import RoomPickerUtil from "../../room/util/roomPickerUtil";
import AddressUtil from "../../networking/util/addressUtil";
import EditRateLogUtil from "./editRateLogUtil";

// How a connected user arrives and leaves, whatever carries them (see UserContext).
const UserSessionUtil =
{
    // Registers the user. Metadata is bridged by ServerUserManager.recentDisconnectMetadata whether an older
    // connection's end came before (Case B) or after (Case A) this one; Case A only needs the older evicted here.
    admit: async (ctx: UserContext): Promise<void> =>
    {
        const oldContext = ServerUserManager.getSocketUserContext(ctx.user.id);
        if (oldContext)
        {
            // Case A: a new connection before the old one ended (refresh, or another tab).
            console.warn(`(UserSessionUtil) Replacing existing connection for userID = ${ctx.user.id} (likely page refresh)`);
            ServerUserManager.removeUser(ctx.user.id);
            await ServerRoomManager.changeUserRoom(oldContext, undefined, false, true, false);
            oldContext.disconnect(AddressUtil.getErrorPageURL("auth-duplication"));
        }
        ServerUserManager.addUser(ctx);
    },
    // Joins the best room, falling back to one that isn't full.
    joinFirstRoom: async (ctx: UserContext): Promise<void> =>
    {
        const roomID = await RoomPickerUtil.pickBestRoomID(ctx, "appStart");
        const roomChangeResult = await ServerRoomManager.changeUserRoom(ctx, roomID, false, false, true);
        ServerRoomManager.notifyRoomChangeRejection(ctx, roomChangeResult);
    },
    // Takes the user out of their room once their connection has ended. A context already replaced by a newer
    // connection, or cleaned up, is skipped: its metadata was captured then.
    release: async (ctx: UserContext): Promise<void> =>
    {
        if (ServerUserManager.getSocketUserContext(ctx.user.id) != ctx)
        {
            console.warn(`(UserSessionUtil) Skipping stale release (userID = ${ctx.user.id})`);
            return;
        }

        // removeUserFromRoom snapshots playerMetadata synchronously before the DB write, so a quick reconnect
        // still sees it.
        ServerUserManager.removeUser(ctx.user.id);
        EditRateLogUtil.flush(ctx.user);
        await ServerRoomManager.changeUserRoom(ctx, undefined, false, true, false);
    },
}

export default UserSessionUtil;
