import { FieldValue } from "firebase-admin/firestore";
import FirebaseUtil from "../networking/util/firebaseUtil";
import DBCacheUtil from "../db/util/dbCacheUtil";
import LogUtil from "../../shared/system/util/logUtil";
import AcquisitionSourceUtil from "./util/acquisitionSourceUtil";
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

// ─── What this process already knows ─────────────────────────────────────
// Maps an account to the milestone letters this process has confirmed are on its row, or is in the
// middle of writing.
//
// This is what allows recordMilestone to sit on the edit path at all. Every voxel placed and every
// object moved calls it, and without this each one would be a Firestore read of the player's row —
// asking a question whose answer stopped changing after their first edit of the session.
//
// It is not a cache of the row: it holds no row data, only the knowledge that a write has already
// happened. That knowledge cannot expire, because a milestone is recorded once and is never reset.
// And it can only ever be wrong in the direction of doing the read anyway — a fresh process, or a
// second server behind the same database, simply starts with an empty map and pays one read per
// account per milestone. The read is still what decides, so a missing entry costs a lookup rather
// than a wrong count.
const recordedMilestones = new Map<string, string>();

// Bounded, because this is an optimisation and not state: a process up for weeks would otherwise
// hold an entry for every account that ever connected to it. Map iterates in insertion order, so
// the oldest entry is the one dropped, and dropping one only means the next call for that account
// does the read it would have done anyway. (An entry evicted while its own write was still in
// flight could let a concurrent call count that milestone twice — the same hazard two server
// processes already have, at a size where it would take twenty thousand accounts arriving between
// one edit and its write.)
const RECORDED_MILESTONES_MAX_ACCOUNTS = 20_000;

function isKnownRecorded(userID: string, milestone: FunnelMilestone): boolean
{
    return (recordedMilestones.get(userID) ?? "").includes(milestone);
}

function markRecorded(userID: string, milestone: FunnelMilestone): void
{
    const known = recordedMilestones.get(userID);

    if (known == undefined && recordedMilestones.size >= RECORDED_MILESTONES_MAX_ACCOUNTS)
    {
        const oldest = recordedMilestones.keys().next().value;
        if (oldest != undefined)
            recordedMilestones.delete(oldest);
    }

    if (!(known ?? "").includes(milestone))
        recordedMilestones.set(userID, `${known ?? ""}${milestone}`);
}

// Gives back a claim that was made but not carried through, so that a later call retries instead of
// the milestone being lost for as long as this process lives.
function unmarkRecorded(userID: string, milestone: FunnelMilestone): void
{
    const known = recordedMilestones.get(userID);
    if (known == undefined)
        return;

    const remaining = known.replace(milestone, "");
    if (remaining.length > 0)
        recordedMilestones.set(userID, remaining);
    else
        recordedMilestones.delete(userID);
}

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

        // Somebody already counted as a repeat visitor has nothing further to record, however many
        // more days they come back on, so their later visits need not be read at all.
        if (isKnownRecorded(userID, FunnelMilestoneEnumMap.RetainedRepeat))
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
    // rather than only the first — the caller is not expected to know which is which. Once this
    // process has recorded the milestone for the account, further calls cost a map lookup and
    // return without touching the database.
    recordMilestone: async (userID: string, milestone: FunnelMilestone): Promise<void> =>
    {
        if (!userID)
            return;

        if (isKnownRecorded(userID, milestone))
            return;

        // Claimed before the read rather than after the write. A player placing blocks quickly
        // produces a burst of calls that would otherwise all read the row before any of them had
        // written it — sending a burst of identical reads, and counting the same person more than
        // once. The claim is given back below if the work does not complete.
        markRecorded(userID, milestone);

        try
        {
            const db = await FirebaseUtil.getDB();
            const docRef = db.collection(COLLECTION_USERS).doc(userID);

            // Read straight through rather than from DBCacheUtil. The cache is there to spare the
            // request path repeated lookups and may be up to its TTL out of date; acting on a stale
            // funnel string here would count the same milestone twice for the same person.
            const doc = await docRef.get();
            if (!doc.exists)
            {
                // Usually an account that has since been deleted, but possibly one still being
                // created, so the claim is released rather than standing for the process's life.
                unmarkRecorded(userID, milestone);
                return;
            }

            const data = doc.data() ?? {};
            const funnel: string = typeof data.funnel == "string" ? data.funnel : "";
            if (funnel.includes(milestone))
                return; // Recorded before this process started. The claim is correct as it stands.

            const source: string = typeof data.acquisitionSource == "string" && data.acquisitionSource.length > 0
                ? data.acquisitionSource
                : AcquisitionSourceUtil.normalize(undefined);
            const createdAt: number = typeof data.createdAt == "number" ? data.createdAt : Date.now();

            // The row is stamped before the total is incremented. If the process dies between the
            // two, the cohort undercounts by one — whereas the other order would let a retry count
            // the same person twice, and a total that drifts upward is the one that misleads.
            await docRef.update({ funnel: `${funnel}${milestone}` });
            DBCacheUtil.invalidate(COLLECTION_USERS, userID);

            await increment(source, AcquisitionSourceUtil.cohortDay(createdAt), milestone);
        }
        catch (err)
        {
            unmarkRecorded(userID, milestone);
            LogUtil.log("ServerAnalyticsManager.recordMilestone failed", { userID, milestone, err }, "low", "error");
        }
    },
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
