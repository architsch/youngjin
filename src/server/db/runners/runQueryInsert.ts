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
    // A caller that hands over a row it has been working with will usually have an "id" on it.
    // That is the document's identity, not one of its fields, so it never goes into the document
    // (see DBRowIdentityUtil) — and on the generated-ID path below it could not be right anyway,
    // since the ID does not exist until the write that creates it.
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