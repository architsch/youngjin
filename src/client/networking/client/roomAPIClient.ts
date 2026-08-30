import App from "../../app";
import RestAPI, { RestAPIResponse } from "../api/restAPI";
import { ROOM_API_ROUTE_PATH } from "../../../shared/system/sharedConstants";

const RoomAPIClient =
{
    // Naming no room type asks for the room a member owns. Asking for a Hub is world-building, and
    // the server allows it only to an admin.
    createRoom: async (roomType?: number): Promise<RestAPIResponse> =>
    {
        return await RestAPI.post(getURL("create_room"), { data: { roomType } });
    },
    // Naming no room re-skins the user's own. Naming one is an admin re-skinning a hub, which
    // nobody owns.
    changeRoomTexture: async (texturePackPath: string, roomID?: string): Promise<RestAPIResponse> =>
    {
        return await RestAPI.post(getURL("change_room_texture"), { data: { texturePackPath, roomID } });
    },
    setRoomUserRole: async (targetUserName: string, userRole: number): Promise<RestAPIResponse> =>
    {
        return await RestAPI.post(getURL("set_room_user_role"), { data: { targetUserName, userRole } });
    },
    getRoomEditors: async (): Promise<RestAPIResponse> =>
    {
        return await RestAPI.post(getURL("get_room_editors"));
    },
    getHubRoomListEntries: async (): Promise<RestAPIResponse> =>
    {
        return await RestAPI.post(getURL("get_hub_room_list_entries"));
    },
}

function getURL(type: string): string
{
    return `${App.getEnv().rest_api_server_url}/${ROOM_API_ROUTE_PATH}/${type}`;
}

export default RoomAPIClient;
