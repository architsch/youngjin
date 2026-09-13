import { FieldValue } from "firebase-admin/firestore";
import FirebaseUtil from "../networking/util/firebaseUtil";
import DBCacheUtil from "../db/util/dbCacheUtil";
import LogUtil from "../../shared/system/util/logUtil";
import AcquisitionSourceUtil from "./util/acquisitionSourceUtil";
import SocketUserContext from "../sockets/types/socketUserContext";
import { FunnelMilestone, FunnelMilestoneEnumMap } from "./types/funnelMilestone";
import { COLLECTION_ACQUISITION, COLLECTION_USERS } from "../system/serverConstants";

// Acquisition funnel recording (see @docs/devOps/analytics.md). Accounts hold their source and
// recorded milestones (count once per person); per-cohort counter documents hold totals, since bounced
// guests get deleted. Writes Firestore directly (not DBQuery): counters are atomic-increment
// accumulators with no migration or cache. The user-row write still invalidates that row's cache.
// Every entry point swallows errors so gameplay is never interrupted.

const ServerAnalyticsManager =
{
    // Called right after account creation (the row already has source and Arrived; see
    // DBUserUtil.createUser), so only the cohort total is incremented.
    recordArrival: async (source: string, createdAtMs: number): Promise<void> =>
    {
        await increment(source, AcquisitionSourceUtil.cohortDay(createdAtMs), FunnelMilestoneEnumMap.Arrived);
    },

    // On a distinct login: Returned the first time, RetainedRepeat afterwards. Reads the funnel once to
    // decide.
    recordReturnVisit: async (userID: string): Promise<void> =>
    {
        if (!userID)
            return;

        try
        {
            const db = await FirebaseUtil.getDB();
            const doc = await db.collection(COLLECTION_USERS).doc(userID).get();
            if (!doc.exists)
                return;

            const funnel: string = typeof doc.data()?.funnel == "string" ? doc.data()!.funnel : "";
            const milestone = funnel.includes(FunnelMilestoneEnumMap.Returned)
                ? FunnelMilestoneEnumMap.RetainedRepeat
                : FunnelMilestoneEnumMap.Returned;

            await ServerAnalyticsManager.recordMilestone(userID, milestone);
        }
        catch (err)
        {
            LogUtil.log("ServerAnalyticsManager.recordReturnVisit failed", { userID, err }, "low", "error");
        }
    },

    // Call on every occurrence. `session` (from the live connection) answers repeats from memory, so
    // only the first reaches the DB; HTTP callers omit it.
    recordMilestone: async (userID: string, milestone: FunnelMilestone,
        session?: SocketUserContext): Promise<void> =>
    {
        if (!userID)
            return;

        if (session)
        {
            if (session.funnel.includes(milestone))
                return;

            // Claimed synchronously before any await, so bursts don't all read the row; released on
            // failure so it's retried.
            session.funnel += milestone;
        }

        try
        {
            const db = await FirebaseUtil.getDB();
            const docRef = db.collection(COLLECTION_USERS).doc(userID);

            // The row decides, not the session copy (which can only say "already done"). Read
            // directly, bypassing DBCacheUtil, since a stale cache could double-count.
            const doc = await docRef.get();
            if (!doc.exists)
            {
                releaseClaim(session, milestone);
                return;
            }

            const data = doc.data() ?? {};
            const funnel: string = typeof data.funnel == "string" ? data.funnel : "";
            if (funnel.includes(milestone))
                return; // Recorded elsewhere. The session's claim is correct as it stands.

            const source: string = typeof data.acquisitionSource == "string" && data.acquisitionSource.length > 0
                ? data.acquisitionSource
                : AcquisitionSourceUtil.normalize(undefined);
            const createdAt: number = typeof data.createdAt == "number" ? data.createdAt : Date.now();

            // Stamp the row before incrementing: a crash in between undercounts rather than double-counts.
            const updatedFunnel = `${funnel}${milestone}`;
            await docRef.update({ funnel: updatedFunnel });
            DBCacheUtil.invalidate(COLLECTION_USERS, userID);

            // Sync the session with the row (including other paths' writes).
            if (session)
                session.funnel = updatedFunnel;

            await increment(source, AcquisitionSourceUtil.cohortDay(createdAt), milestone);
        }
        catch (err)
        {
            releaseClaim(session, milestone);
            LogUtil.log("ServerAnalyticsManager.recordMilestone failed", { userID, milestone, err }, "low", "error");
        }
    },
}

// Releases an uncompleted claim so the next call retries.
function releaseClaim(session: SocketUserContext | undefined, milestone: FunnelMilestone): void
{
    if (session)
        session.funnel = session.funnel.replace(milestone, "");
}

async function increment(source: string, cohortDay: string, milestone: FunnelMilestone): Promise<void>
{
    try
    {
        const db = await FirebaseUtil.getDB();
        await db.collection(COLLECTION_ACQUISITION).doc(`${source}__${cohortDay}`).set(
            {
                source,
                cohortDay,
                counts: { [milestone]: FieldValue.increment(1) },
                updatedAt: Date.now(),
            },
            { merge: true });
    }
    catch (err)
    {
        LogUtil.log("ServerAnalyticsManager - failed to increment cohort counter",
            { source, cohortDay, milestone, err }, "low", "error");
    }
}

export default ServerAnalyticsManager;
