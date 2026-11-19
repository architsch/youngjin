import { USER_BUDGETS } from "../../system/serverConstants";
import { MINUTE_IN_MS } from "../../../shared/system/sharedConstants";
import LogUtil from "../../../shared/system/util/logUtil";
import { UserBudgetKind } from "../types/userBudgetKind";

// How often the users whose budgets have all filled back up are forgotten, in spends.
const SPENDS_PER_SWEEP = 1000;
// A budget's refusals are logged at most this often, so a flood logs a line, not a flood.
const REFUSAL_LOG_INTERVAL_MS = MINUTE_IN_MS;

type Budget = {level: number, updatedAt: number, refusalLoggedAt: number};

const budgetsByUserID = new Map<string, Map<UserBudgetKind, Budget>>();
let spendsSinceSweep = 0;

// How much each user may still do, kind by kind (see USER_BUDGETS): a store that fills back up at a steady rate, which
// whatever the user does is paid from, and which refuses what it can't pay for. Kept by user rather than by
// connection, so that coming back refills nothing.
const UserBudgetUtil =
{
    budgetsByUserID,
    getLevel: (userID: string, kind: UserBudgetKind): number =>
    {
        return getBudget(userID, kind, Date.now()).level;
    },
    // Takes the cost if the user has that much; false, taking nothing, if not.
    trySpend: (userID: string, kind: UserBudgetKind, cost: number = 1): boolean =>
    {
        if (++spendsSinceSweep >= SPENDS_PER_SWEEP)
            forgetFullBudgets();
        const now = Date.now();
        const budget = getBudget(userID, kind, now);
        if (budget.level >= cost)
        {
            budget.level -= cost;
            return true;
        }
        // Logged, so that what meets a budget can be seen (see EditRateLogUtil for what everyone does).
        if (now - budget.refusalLoggedAt >= REFUSAL_LOG_INTERVAL_MS)
        {
            budget.refusalLoggedAt = now;
            LogUtil.log("Budget spent", {userID, kind}, "medium", "warn");
        }
        return false;
    },
    // How long until the user has the cost again.
    getSecondsUntil: (userID: string, kind: UserBudgetKind, cost: number = 1): number =>
    {
        const missing = cost - UserBudgetUtil.getLevel(userID, kind);
        return (missing > 0) ? Math.ceil(missing / USER_BUDGETS[kind].refillPerSecond) : 0;
    },
}

// The budget as it stands now, filled back up for the time since it was last looked at.
function getBudget(userID: string, kind: UserBudgetKind, now: number): Budget
{
    const {capacity, refillPerSecond} = USER_BUDGETS[kind];
    let budgets = budgetsByUserID.get(userID);
    if (budgets == undefined)
        budgetsByUserID.set(userID, budgets = new Map());
    let budget = budgets.get(kind);
    if (budget == undefined)
        budgets.set(kind, budget = {level: capacity, updatedAt: now, refusalLoggedAt: -Infinity});
    budget.level = Math.min(capacity, budget.level + refillPerSecond * Math.max(0, now - budget.updatedAt) / 1000);
    budget.updatedAt = now;
    return budget;
}

// A user whose budgets are all full is as one never seen.
function forgetFullBudgets(): void
{
    spendsSinceSweep = 0;
    const now = Date.now();
    for (const [userID, budgets] of budgetsByUserID)
    {
        if ([...budgets.keys()].every(kind => getBudget(userID, kind, now).level >= USER_BUDGETS[kind].capacity))
            budgetsByUserID.delete(userID);
    }
}

export default UserBudgetUtil;
