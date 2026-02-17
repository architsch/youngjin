import FirebaseUtil from "../../networking/util/firebaseUtil";
import DBQuery from "../types/dbQuery";
import DBQueryResponse from "../types/dbQueryResponse";
import { DBRow } from "../types/row/dbRow";
import LogUtil from "../../../shared/system/util/logUtil";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import DBCacheUtil from "../util/dbCacheUtil";

export default async function runQueryBatch<T extends DBRow>(
    queries: DBQuery<T>[]
): Promise<DBQueryResponse<T>>
{
    try {
        const db = await FirebaseUtil.getDB();
        const batchSize = 500; // Firestore batch limit
        for (let i = 0; i < queries.length; i += batchSize)
        {
            const batch = db.batch();
            const chunk = queries.slice(i, i + batchSize);
            for (const query of chunk)
            {
                if (!query.docId)
                    throw new Error("runQueryBatch :: Each query must target a specific document (where id == ...).");

                // Invalidate cache before the write, so stale data is never served
                if (!query._skipCacheInvalidation)
                    DBCacheUtil.invalidate(query.tableId, query.docId);

                const docRef = db.collection(query.tableId).doc(query.docId);
                switch (query.type)
                {
                    case "update":
                        batch.update(docRef, query.columnValues);
                        break;
                    case "delete":
                        batch.delete(docRef);
                        break;
                    default:
                        throw new Error(`runQueryBatch :: Unsupported query type "${query.type}". Only "update" and "delete" are supported.`);
                }
            }
            await batch.commit();
        }
        LogUtil.log(`DB Batch Query Succeeded (numQueries = ${queries.length})`, {}, "medium");
        return { success: true, data: [] };
    }
    catch (err) {
        LogUtil.log("DB Batch Query Error", {errorMessage: ErrorUtil.getErrorMessage(err)}, "high", "error");
        return { success: false, data: [] };
    }
}
