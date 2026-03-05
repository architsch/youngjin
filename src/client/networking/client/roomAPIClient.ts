import App from "../../app";
import RestAPI, { RestAPIResponse } from "../api/restAPI";
import { ROOM_API_ROUTE_PATH } from "../../../shared/system/sharedConstants";

const RoomAPIClient =
{
    createRoom: async (): Promise<RestAPIResponse> =>
    {
        return await RestAPI.post(getURL("create_room"));
    },
    changeRoomTexture: async (texturePackPath: string): Promise<RestAPIResponse> =>
    {
        return await RestAPI.post(getURL("change_room_texture"), { data: { texturePackPath } });
    },
    setRoomUserRole: async (targetUserName: string, userRole: number): Promise<RestAPIResponse> =>
    {
        return await RestAPI.post(getURL("set_room_user_role"), { data: { targetUserName, userRole } });
    },
    getRoomEditors: async (): Promise<RestAPIResponse> =>
    {
        return await RestAPI.post(getURL("get_room_editors"));
    },
}

function getURL(type: string): string
{
    return `${App.getEnv().rest_api_server_url}/${ROOM_API_ROUTE_PATH}/${type}`;
}

export default RoomAPIClient;
