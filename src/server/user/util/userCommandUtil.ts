import LogUtil from "../../../shared/system/util/logUtil";
import UserCommandParams from "../../../shared/user/types/userCommandParams";
import User from "../../../shared/user/types/user";
import DBUserUtil from "../../db/util/dbUserUtil";

const UserCommandUtil =
{
    handleCommand: async (user: User, params: UserCommandParams): Promise<void> =>
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
            case "tutorialStep":
                await handleTutorialStepCommand(user, words, params);
                break;
            default:
                LogUtil.log("Unknown user command type", {commandType, params}, "high", "error");
                break;
        }
    },
}

async function handleTutorialStepCommand(user: User, words: string[], params: UserCommandParams): Promise<void>
{
    if (words.length < 2)
    {
        LogUtil.log("No tutorial step specified", {params}, "high", "error");
        return;
    }
    const step = parseInt(words[1]);
    if (isNaN(step))
    {
        LogUtil.log("Invalid tutorial step specified", {params}, "high", "error");
        return;
    }
    if (user.tutorialStep == step)
    {
        LogUtil.log("Tutorial step already set", {params}, "high", "error");
        return;
    }
    user.tutorialStep = step;
    await DBUserUtil.setUserTutorialStep(user.id, step);
}

export default UserCommandUtil;