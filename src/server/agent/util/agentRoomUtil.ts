import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import Room from "../../../shared/room/types/room";
import ServerRoomManager from "../../room/serverRoomManager";
import ServerUserManager from "../../user/serverUserManager";
import AddressUtil from "../../networking/util/addressUtil";
import { AGENT_LINK_ACQUISITION_SOURCE } from "../../system/serverConstants";
import AgentUserContext from "../types/agentUserContext";

// Firestore document ids, so that no room an agent names can be a single-player one (e.g. the tutorial).
const ROOM_ID_PATTERN = /^[A-Za-z0-9]{20}$/;

// The room an agent's tools act in, its own player there, and the rooms it names.
const AgentRoomUtil =
{
    // The room an id or a link names (a link ends with the room's id; see PageRouter); undefined for anything else.
    parseRoomID: (text: string): string | undefined =>
    {
        const lastSegment = text.trim().split(/[?#]/)[0].split("/").filter(part => part.length > 0).pop() ?? "";
        return ROOM_ID_PATTERN.test(lastSegment) ? lastSegment : undefined;
    },
    // Opens the room for a person in a browser, and takes an agent there by travel.
    getLink: (roomID: string): string =>
    {
        return `${AddressUtil.getEnvDynamicURL()}/${roomID}?ref=${AGENT_LINK_ACQUISITION_SOURCE}`;
    },
    // Quietly undefined while the agent is in no room, between trips or after a refused one.
    getCurrentRoom: (ctx: AgentUserContext): Room | undefined =>
    {
        const roomID = ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
        return roomID == undefined ? undefined : ServerRoomManager.roomRuntimeMemories[roomID]?.room;
    },
    getMyPlayer: (ctx: AgentUserContext): AddObjectSignal | undefined =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        const player = ServerUserManager.getPlayerObject(ctx.user.id);
        return (room != undefined && player != undefined) ? room.objectById[player.objectId] : undefined;
    },
}

export default AgentRoomUtil;
