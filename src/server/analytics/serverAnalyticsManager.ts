import { FieldValue } from "firebase-admin/firestore";
import FirebaseUtil from "../networking/util/firebaseUtil";
import DBCacheUtil from "../db/util/dbCacheUtil";
import LogUtil from "../../shared/system/util/logUtil";
import AcquisitionSourceUtil from "./util/acquisitionSourceUtil";
import SocketUserContext from "../sockets/types/socketUserContext";
import { FunnelMilestone, FunnelMilestoneEnumMap } from "./types/funnelMilestone";
import { COLLECTION_ACQUISITION, COLLECTION_USERS } from "../system/serverConstants";

// Counts how far the visitors from each traffic source get, so that two sources can be compared by
// what their people went on to do rather than by how many of them arrived.
//
// Two places hold the answer, and both are needed:
//
//   - Each account carries the source it arrived from and the milestones it has already been
//     counted for. That is what makes a milestone count once per person, and what lets a return
//     visit weeks later still be credited to the source that first brought them.
//   - A per-cohort counter document holds the totals. It exists because the accounts do not: a
//     visitor who bounces is a guest, and stale guests are deleted, so a tally that lived only on
//     the rows would quietly lose exactly the people a disappointing source sent.
//
// This module talks to Firestore directly rather than through DBQuery, which is a deliberate
// exception to the rule elsewhere in the server. The counter documents are pure accumulators: they
// are never migrated, never cached, never read while serving a request, and they are written with
// atomic increments so that concurrent visitors do not overwrite each other's totals — none of
// which DBQuery offers, and its version-migration and cache-invalidation paths would be actively
// wrong here. The one user-row write below does go on to invalidate that row's cache entry, since
// that row *is* served through the cached path.
//
// Nothing here is allowed to interrupt what the player was doing. Every entry point swallows its
// own errors: a lost count is a worse report, while a thrown error is a lost visitor.

const ServerAnalyticsManager =
{
    // Called once, immediately after an account is minted. The row is written with its source and
    // its first milestone already on it (see DBUserUtil.createUser), so all that is left is the
    // cohort's total.
    recordArrival: async (source: string, createdAtMs: number): Promise<void> =>
    {
        await increment(source, AcquisitionSourceUtil.cohortDay(createdAtMs), FunnelMilestoneEnumMap.Arrived);
    },

    // Called when a visit is recognised as a distinct login — that is, when somebody has come back
    // after being away. The first such visit is a return; any later one says the return was not a
    // one-off. Which of the two it is can only be told from the funnel already recorded, so this
    // reads that string once and hands the answer to recordMilestone rather than making both calls
    // and having the first one's read go to waste.
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

    // Called wherever a player does one of the things the funnel measures, on every occurrence
    // rather than only the first — the caller is not expected to know which is which.
    //
    // `session` is what makes that affordable. A caller holding the live connection already has
    // this account's recorded milestones, loaded from its row when the socket authenticated, so the
    // repeat calls — which are nearly all of them on the edit path — are answered from memory and
    // never reach the database. Callers without a connection omit it; the HTTP paths record at most
    // a handful of milestones per account in its whole lifetime, so a read each costs nothing.
    recordMilestone: async (userID: string, milestone: FunnelMilestone,
        session?: SocketUserContext): Promise<void> =>
    {
        if (!userID)
            return;

        if (session)
        {
            if (session.funnel.includes(milestone))
                return;

            // Claimed synchronously, before the first await. A player placing blocks quickly
            // produces a burst of calls that would otherwise all get past this line and all read
            // the row before any of them had written it. Given back below if the work does not
            // complete, so a failed attempt is retried rather than lost for the whole session.
            session.funnel += milestone;
        }

        try
        {
            const db = await FirebaseUtil.getDB();
            const docRef = db.collection(COLLECTION_USERS).doc(userID);

            // The row, not the session, is what decides whether to count. The session's copy was
            // taken when the connection opened and another path may have recorded something since,
            // so it is trusted to say "already done" — which can only become more true — and never
            // to say "not yet".
            //
            // Read straight through rather than from DBCacheUtil, for the same reason: the cache is
            // there to spare the request path repeated lookups and may be up to its TTL out of
            // date, and acting on a stale funnel string here would count the same milestone twice.
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

            // The row is stamped before the total is incremented. If the process dies between the
            // two, the cohort undercounts by one — whereas the other order would let a retry count
            // the same person twice, and a total that drifts upward is the one that misleads.
            const updatedFunnel = `${funnel}${milestone}`;
            await docRef.update({ funnel: updatedFunnel });
            DBCacheUtil.invalidate(COLLECTION_USERS, userID);

            // Brought fully into step with the row, which also picks up whatever another path
            // recorded while this connection was open.
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

// Takes back a claim that was made on a session but not carried through, so that the next call
// tries again instead of the milestone being lost for as long as the connection lives.
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
