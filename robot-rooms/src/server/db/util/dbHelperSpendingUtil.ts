import { FieldValue } from "firebase-admin/firestore";
import FirebaseUtil from "../../networking/util/firebaseUtil";
import LogUtil from "../../../shared/system/util/logUtil";
import { COLLECTION_HELPER_SPENDING } from "../../system/serverConstants";

// What helpers have spent on Claude, a document per day (UTC) in millionths of a dollar, kept so that a restart
// doesn't hand them the day's budget anew (see HelperChatUtil). Written directly with atomic increments, as the
// acquisition counters are (see ServerAnalyticsManager).
const DBHelperSpendingUtil =
{
    // Undefined if it couldn't be read.
    getSpent: async (date: string): Promise<number | undefined> =>
    {
        try
        {
            const db = await FirebaseUtil.getDB();
            const doc = await db.collection(COLLECTION_HELPER_SPENDING).doc(date).get();
            return doc.exists ? (doc.data()?.microDollars ?? 0) : 0;
        }
        catch (err)
        {
            LogUtil.log("DBHelperSpendingUtil - failed to read the day's spending", {date, err}, "high", "error");
            return undefined;
        }
    },
    // False if it couldn't be written.
    addSpent: async (date: string, microDollars: number): Promise<boolean> =>
    {
        try
        {
            const db = await FirebaseUtil.getDB();
            await db.collection(COLLECTION_HELPER_SPENDING).doc(date).set(
                {microDollars: FieldValue.increment(microDollars), updatedAt: Date.now()}, {merge: true});
            return true;
        }
        catch (err)
        {
            LogUtil.log("DBHelperSpendingUtil - failed to add to the day's spending", {date, err}, "high", "error");
            return false;
        }
    },
}

export default DBHelperSpendingUtil;
