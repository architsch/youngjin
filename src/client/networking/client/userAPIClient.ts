import App from "../../app";
import RestAPI, { RestAPIResponse } from "../api/restAPI";
import { USER_API_ROUTE_PATH } from "../../../shared/system/sharedConstants";
import { tryStartClientProcess } from "../../system/types/clientProcess";

const UserAPIClient =
{
    loginWithGoogle: (): void =>
    {
        tryStartClientProcess("pageTerminated", 1, 0);
        window.location.href = getURL("login_google");
    },
    logout: async (): Promise<RestAPIResponse> =>
    {
        tryStartClientProcess("pageTerminated", 1, 0);
        return await RestAPI.post(getURL("logout"));
    },
}

function getURL(type: string): string
{
    return `${App.getEnv().rest_api_server_url}/${USER_API_ROUTE_PATH}/${type}`;
}

export default UserAPIClient;