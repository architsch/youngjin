import { AxiosRequestConfig } from "axios";
import App from "../../app";
import RestAPI, { RestAPIResponse } from "../api/restAPI";
import { USER_API_ROUTE_PATH } from "../../../shared/system/constants";

const UserAPIClient =
{
    register: async (userName: string, password: string): Promise<RestAPIResponse> =>
    {
        return await RestAPI.post(getURL("register"), {userName, password} as AxiosRequestConfig);
    },
    login: async (userName: string, password: string): Promise<RestAPIResponse> =>
    {
        return await RestAPI.post(getURL("login"), {userName, password} as AxiosRequestConfig);
    },
    logout: async (): Promise<RestAPIResponse> =>
    {
         return await RestAPI.get(getURL("login"));
    },
}

function getURL(type: string): string
{
    return `${App.getEnv().rest_api_server_url}/${USER_API_ROUTE_PATH}/${type}`;
}

export default UserAPIClient;