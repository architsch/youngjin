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
    // Re-skins the named room. Which rooms a caller may decorate — their own, and, for an admin, a
    // hub — is the server's to decide from the room itself (see the room API's router).
    changeRoomTexture: async (texturePackPath: string, roomID: string): Promise<RestAPIResponse> =>
    {
        return await RestAPI.post(getURL("change_room_texture"), { data: { texturePackPath, roomID } });
    },
    // Re-lights the named room, on the same terms re-skinning one is.
    changeRoomPrefs: async (prefs: string, roomID: string): Promise<RestAPIResponse> =>
    {
        return await RestAPI.post(getURL("change_room_prefs"), { data: { prefs, roomID } });
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
