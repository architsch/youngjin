import App from "../../app";
import RestAPI from "../api/restAPI";
import HelperRemarkSubject from "../../../shared/object/types/helperRemarkSubject";
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
    // What two helpers the browser plays in a single-player room say to each other as they chat (see
    // SinglePlayerHelperUtil): each line by its speaker's place among them, and none, as when the server can't be
    // reached, for no chat.
    smallTalk: async (helpers: {name: string, personality: string}[]): Promise<{by: number, text: string}[]> =>
    {
        const response = await RestAPI.post(getURL("smalltalk"), { data: { helpers } });
        const lines: unknown = response.status == 200 ? response.data?.lines : undefined;
        return Array.isArray(lines) && lines.every(line => typeof line?.text == "string"
            && Number.isInteger(line?.by) && line.by >= 0 && line.by < helpers.length) ? lines : [];
    },
    // Which of the things a helper the browser plays in a single-player room could go and look at it does, and what it
    // says of it (see SinglePlayerHelperUtil): by the thing's place among them, and none, as when the server can't be
    // reached, for no look.
    remark: async (objectId: string, personality: string, things: HelperRemarkSubject[]):
        Promise<{index: number, text: string} | undefined> =>
    {
        const response = await RestAPI.post(getURL("remark"), { data: { objectId, personality, things } });
        const {index, text} = (response.status == 200) ? response.data ?? {} : {};
        return (Number.isInteger(index) && index >= 0 && index < things.length && typeof text == "string"
            && text.length > 0) ? {index, text} : undefined;
    },
}

function getURL(type: string): string
{
    return `${App.getEnv().rest_api_server_url}/${HELPER_API_ROUTE_PATH}/${type}`;
}

export default HelperAPIClient;
