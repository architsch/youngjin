import { UserBudgetKind } from "../../user/types/userBudgetKind";
import UserBudgetUtil from "../../user/util/userBudgetUtil";

// What agents are told of the budgets they spend as people do (see UserBudgetUtil).
const AgentBudgetUtil =
{
    // How long until the agent has the cost again, in words.
    describeWait: (userID: string, kind: UserBudgetKind, cost: number = 1): string =>
    {
        const seconds = Math.max(1, UserBudgetUtil.getSecondsUntil(userID, kind, cost));
        return (seconds == 1) ? "a second" : `${seconds} seconds`;
    },
}

export default AgentBudgetUtil;
