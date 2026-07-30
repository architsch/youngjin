import LogUtil from "../../../shared/system/util/logUtil";
import UserCommandSignal from "../../../shared/user/types/userCommandSignal";
import User from "../../../shared/user/types/user";
import DBUserUtil from "../../db/util/dbUserUtil";

const UserCommandUtil =
{
    onUserCommandSignalReceived: async (user: User, params: UserCommandSignal): Promise<void> =>
    {
        const words = params.message.split(" ");
        if (words.length == 0)
        {
            LogUtil.log("No user command type specified", {params}, "high", "error");
            return;
        }
        const commandType = words[0];

        switch (commandType)
        {
            case "finishSinglePlayerMode":
                await handleFinishSinglePlayerModeCommand(user, words, params);
                break;
            case "addFTUEElement":
                await handleAddFTUEElement(user, words, params);
                break;
            default:
                LogUtil.log("Unknown user command type", {commandType, params}, "high", "error");
                break;
        }
    },
}

async function handleFinishSinglePlayerModeCommand(user: User, words: string[], params: UserCommandSignal): Promise<void>
{
    if (user.singlePlayerMode == "")
    {
        LogUtil.log("SinglePlayerMode is already over", {params}, "high", "error");
        return;
    }
    user.singlePlayerMode = "";
    await DBUserUtil.setSinglePlayerMode(user.id, "");
}

async function handleAddFTUEElement(user: User, words: string[], params: UserCommandSignal): Promise<void>
{
    const element = words[1];
    // One letter per FTUE element (the client's FTUEUtil owns the mapping). Letters are the only
    // thing that may be persisted here: the user's record is embedded verbatim in the page that
    // boots the client app, so a quote or a backslash reaching it would break that page.
    if (!element || !/^[A-Za-z]$/.test(element))
    {
        LogUtil.log("FTUE element is not properly specified", {params}, "high", "error");
        return;
    }
    if (user.ftue.includes(element))
    {
        LogUtil.log("FTUE element already exists in the user", {params}, "high", "error");
        return;
    }
    // The in-memory user is what the rest of this session reads, so it has to carry the new element
    // as well — otherwise the next element added would be appended to a stale string, dropping this
    // one, and the duplicate check above would stop recognizing what has already been stored.
    user.ftue = `${user.ftue}${element}`;
    await DBUserUtil.setFTUE(user.id, user.ftue);
}

export default UserCommandUtil;