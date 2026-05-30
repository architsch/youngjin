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
            case "finishTutorial":
                await handleFinishTutorialCommand(user, words, params);
                break;
            default:
                LogUtil.log("Unknown user command type", {commandType, params}, "high", "error");
                break;
        }
    },
}

async function handleFinishTutorialCommand(user: User, words: string[], params: UserCommandSignal): Promise<void>
{
    if (user.singlePlayerMode != "tutorial")
    {
        LogUtil.log("Tutorial is already over", {params}, "high", "error");
        return;
    }
    user.singlePlayerMode = "";
    await DBUserUtil.setSinglePlayerMode(user.id, "");
}

export default UserCommandUtil;