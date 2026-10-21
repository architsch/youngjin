import App from "../../app";
import RestAPI from "../api/restAPI";
import { HELPER_API_ROUTE_PATH } from "../../../shared/system/sharedConstants";

const HelperAPIClient =
{
    // What a helper the browser plays in a single-player room answers what the user said to it (see
    // SinglePlayerHelperUtil), in the character its NPC has: "" for nothing to say, as when the server can't be reached.
    reply: async (objectId: string, name: string, personality: string, text: string): Promise<string> =>
    {
        const response = await RestAPI.post(getURL("reply"), { data: { objectId, name, personality, text } });
        return (response.status == 200 && typeof response.data?.reply == "string") ? response.data.reply : "";
    },
}

function getURL(type: string): string
{
    return `${App.getEnv().rest_api_server_url}/${HELPER_API_ROUTE_PATH}/${type}`;
}

export default HelperAPIClient;
