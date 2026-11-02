import LogUtil from "../../../shared/system/util/logUtil";
import UserCommandSignal from "../../../shared/user/types/userCommandSignal";
import User from "../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import DBInventoryUtil from "../../db/util/dbInventoryUtil";
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
            case "fastForwardDailyRewardClock":
                await handleFastForwardDailyRewardClock(user, params);
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
    // One letter per element (see FTUEElementUtil). Letters only: the user record is embedded
    // verbatim in the page.
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
    // Update the in-memory user too, or later appends and the duplicate check would use a stale string.
    user.ftue = `${user.ftue}${element}`;
    await DBUserUtil.setFTUE(user.id, user.ftue);
}

// For testing the daily reward, so an admin's alone, which no agent can be. It comes at the next page load, the reward
// being claimed on arriving (see ServerInventoryManager.welcomeUser).
async function handleFastForwardDailyRewardClock(user: User, params: UserCommandSignal): Promise<void>
{
    if (user.userType != UserTypeEnumMap.Admin)
    {
        LogUtil.log("Only an admin can fast-forward the daily reward clock", {params, userID: user.id}, "high", "error");
        return;
    }
    await DBInventoryUtil.fastForwardLoginRewardClock(user.id);
}

export default UserCommandUtil;