import { UserBudgetKind } from "../../user/types/userBudgetKind";
import UserBudgetUtil from "../../user/util/userBudgetUtil";
import { USER_BUDGETS } from "../../system/serverConstants";

// What agents are told of the budgets they spend as people do (see UserBudgetUtil).
const AgentBudgetUtil =
{
    // How long until the agent has the cost again, in words.
    describeWait: (userID: string, kind: UserBudgetKind, cost: number = 1): string =>
    {
        const seconds = Math.max(1, UserBudgetUtil.getSecondsUntil(userID, kind, cost));
        return (seconds == 1) ? "a second" : `${seconds} seconds`;
    },
    // Why the edit budget can't pay for so many edits now, if it can't.
    describeSpentEdits: (userID: string, edits: number): string | undefined =>
    {
        if (UserBudgetUtil.getLevel(userID, "edit") >= edits)
            return undefined;
        return `Your edits have run out: they come back at ${USER_BUDGETS.edit.refillPerSecond} a second, so try `
            + `again in about ${AgentBudgetUtil.describeWait(userID, "edit", edits)}.`;
    },
}

export default AgentBudgetUtil;
