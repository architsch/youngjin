import App from "../../app";
import RestAPI, { RestAPIResponse } from "../api/restAPI";
import { USER_API_ROUTE_PATH } from "../../../shared/system/sharedConstants";

const UserAPIClient =
{
    loginWithGoogle: (): void =>
    {
        window.location.href = getURL("login_google");
    },
    logout: async (): Promise<RestAPIResponse> =>
    {
         return await RestAPI.post(getURL("logout"));
    },
}

function getURL(type: string): string
{
    return `${App.getEnv().rest_api_server_url}/${USER_API_ROUTE_PATH}/${type}`;
}

export default UserAPIClient;