import App from "../../app";
import RestAPI, { RestAPIResponse } from "../api/restAPI";
import { USER_API_ROUTE_PATH } from "../../../shared/system/sharedConstants";
import { tryStartClientProcess } from "../../system/types/clientProcess";
import RoomIdUtil from "../../../shared/room/util/roomIdUtil";

const UserAPIClient =
{
    // Leaves for the provider (see SignInProviderNameMap), naming the room to come back to, whichever account the
    // person then holds.
    signIn: (providerID: string): void =>
    {
        tryStartClientProcess("pageTerminated", 1, 0);
        const roomID = App.getCurrentRoom()?.id ?? "";
        window.location.href = getURL(`login_${providerID}`)
            + (RoomIdUtil.isRoomID(roomID) ? `?roomID=${roomID}` : "");
    },
    logout: async (): Promise<RestAPIResponse> =>
    {
        tryStartClientProcess("pageTerminated", 1, 0);
        return await RestAPI.post(getURL("logout"));
    },
    restartTutorial: async (): Promise<RestAPIResponse> =>
    {
        return await RestAPI.post(getURL("restart_tutorial"));
    },
}

function getURL(type: string): string
{
    return `${App.getEnv().rest_api_server_url}/${USER_API_ROUTE_PATH}/${type}`;
}

export default UserAPIClient;