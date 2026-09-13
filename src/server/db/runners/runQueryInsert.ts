import * as admin from "firebase-admin";
import DBQuery from "../types/dbQuery";
import DBQueryResponse from "../types/dbQueryResponse";
import LogUtil from "../../../shared/system/util/logUtil";
import DBRowIdentityUtil from "../util/dbRowIdentityUtil";
import { DBRow } from "../types/row/dbRow";

export default async function runQueryInsert<T extends DBRow>(
    dbQuery: DBQuery<T>,
    collectionRef: admin.firestore.CollectionReference
): Promise<DBQueryResponse<T>>
{
    // Never store "id" (see DBRowIdentityUtil); on the generated-ID path it doesn't exist yet anyway.
    const columnValues = DBRowIdentityUtil.forStorage(dbQuery.columnValues);

    if (dbQuery.docId)
    {
        await collectionRef.doc(dbQuery.docId).set(columnValues);
        LogUtil.log("DB Query Succeeded", dbQuery.getStateAsObject(), "medium");
        return { success: true, data: [({id: dbQuery.docId} as any) as T] };
    }
    else
    {
        const docRef = await collectionRef.add(columnValues);
        LogUtil.log("DB Query Succeeded", dbQuery.getStateAsObject(), "medium");
        return { success: true, data: [({id: docRef.id} as any) as T] };
    }
}